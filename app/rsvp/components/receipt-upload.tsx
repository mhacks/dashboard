"use client";

import { useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FileCheckIcon, Trash2Icon, UploadIcon } from "lucide-react";

import { FormQuestion } from "@/components/forms/form-question";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  confirmRsvpReceiptUpload,
  removeRsvpReceipt,
  requestRsvpReceiptUpload,
} from "@/lib/actions/rsvp-receipt.server.actions";
import {
  MAX_RSVP_RECEIPT_SIZE_BYTES,
  isRsvpReceiptContentType,
} from "@/lib/rsvp/receipt";
import type { RsvpFormData } from "@/lib/types/rsvps";

type UploadState = "idle" | "uploading" | "removing" | "error";

export type ReceiptMutationVersion = {
  receiptVersion: number;
};

export function ReceiptUpload({
  disabled,
  receiptVersion,
  beforeMutation,
  onMutationChange,
  onVersionChange,
}: {
  disabled: boolean;
  receiptVersion: number;
  beforeMutation: () => Promise<void>;
  onMutationChange: (inProgress: boolean) => void;
  onVersionChange: (version: ReceiptMutationVersion) => void;
}) {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<RsvpFormData>();
  const receipt = useWatch({ control, name: "receipt" });
  const inputRef = useRef<HTMLInputElement>(null);
  const operationRef = useRef(0);
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const receiptPreviewHref = receipt
    ? `/rsvp/receipt/preview?v=${receiptVersion}`
    : "";

  const handleFile = async (file: File) => {
    if (disabled) return;
    if (!isRsvpReceiptContentType(file.type)) {
      setState("error");
      setMessage("Choose a PDF, PNG, or JPEG file.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_RSVP_RECEIPT_SIZE_BYTES) {
      setState("error");
      setMessage("Choose a non-empty file no larger than 10 MB.");
      return;
    }

    const operation = ++operationRef.current;
    onMutationChange(true);
    setState("uploading");
    setMessage("Uploading and verifying receipt...");
    try {
      await beforeMutation();
      const { uploadUrl, uploadId, expectedReceiptVersion } =
        await requestRsvpReceiptUpload({
          originalName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          expectedReceiptVersion: receiptVersion,
        });
      onVersionChange({ receiptVersion: expectedReceiptVersion });
      const upload = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!upload.ok) throw new Error("Storage rejected the upload");

      const confirmed = await confirmRsvpReceiptUpload({
        uploadId,
        originalName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        expectedReceiptVersion,
      });
      if (
        operation !== operationRef.current ||
        getValues("travelPlan") !== "reimbursement"
      ) {
        const removed = await removeRsvpReceipt({
          expectedReceiptVersion: confirmed.receiptVersion,
        });
        onVersionChange(removed);
        return;
      }
      setValue("receipt", confirmed.receipt, {
        shouldDirty: true,
        shouldValidate: true,
      });
      onVersionChange(confirmed);
      setState("idle");
      setMessage("Receipt uploaded and verified.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.",
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      if (operation === operationRef.current) onMutationChange(false);
    }
  };

  const handleRemove = async () => {
    if (disabled) return;
    operationRef.current += 1;
    onMutationChange(true);
    setState("removing");
    setMessage("Removing receipt...");
    try {
      await beforeMutation();
      const removed = await removeRsvpReceipt({
        expectedReceiptVersion: receiptVersion,
      });
      setValue("receipt", undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
      onVersionChange(removed);
      setState("idle");
      setMessage("Receipt removed.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove the receipt.",
      );
    } finally {
      onMutationChange(false);
    }
  };

  return (
    <FormQuestion
      label="Travel reimbursement receipt"
      htmlFor="receipt"
      required
      description="Upload 1 supported file. Max 10 MB. PDF, PNG, or JPEG."
      error={errors.receipt}
    >
      {receipt && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-moss/10 bg-white/70 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileCheckIcon className="size-4 shrink-0 text-moss" />
              <span className="truncate font-red-hat text-sm text-moss">
                {receipt.originalName}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                disabled || state === "uploading" || state === "removing"
              }
              onClick={handleRemove}
              className="rounded-full border-moss/20 bg-transparent px-3 font-red-hat text-moss hover:bg-black/5"
            >
              <Trash2Icon data-icon="inline-start" />
              Remove
            </Button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-moss/10 bg-white/80">
            <div className="flex items-center justify-between gap-3 border-b border-moss/10 px-4 py-2">
              <p className="font-red-hat text-xs font-medium text-moss/65">
                Receipt preview
              </p>
              <p className="font-red-hat text-[0.7rem] text-moss/45">
                {receipt.contentType === "application/pdf" ? "PDF" : "Image"}
              </p>
            </div>
            <object
              data={receiptPreviewHref}
              type={receipt.contentType}
              aria-label={`Preview of ${receipt.originalName}`}
              className="h-72 w-full bg-white sm:h-96"
            >
              <div className="flex min-h-40 items-center justify-center px-4 py-8 text-center font-red-hat text-sm text-moss/55">
                Preview unavailable. Try re-uploading the file.
              </div>
            </object>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Input
          ref={inputRef}
          id="receipt"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          disabled={disabled || state === "uploading" || state === "removing"}
          aria-invalid={Boolean(errors.receipt)}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void handleFile(file);
          }}
          className="min-w-0"
        />
        <UploadIcon
          className="size-4 shrink-0 text-moss/50"
          aria-hidden="true"
        />
      </div>
      {message && (
        <p
          className={
            state === "error"
              ? "font-red-hat text-xs text-destructive"
              : "font-red-hat text-xs text-moss/55"
          }
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </FormQuestion>
  );
}
