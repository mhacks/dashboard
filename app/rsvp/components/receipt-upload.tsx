"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FileCheckIcon, UploadIcon } from "lucide-react";

import { FormQuestion } from "@/components/forms/form-question";
import { Input } from "@/components/ui/input";
import {
  getRsvpReceiptPreviewUrl,
  uploadRsvpReceipt,
} from "@/lib/actions/rsvp-receipt.server.actions";
import {
  MAX_RSVP_RECEIPT_SIZE_BYTES,
  RSVP_RECEIPT_CONTENT_TYPE,
  isRsvpReceiptContentType,
} from "@/lib/rsvp/receipt";
import type { RsvpFormData } from "@/lib/types/rsvps";

type UploadState = "idle" | "uploading" | "error";

export function ReceiptUpload({
  disabled,
  beforeMutation,
  onMutationChange,
}: {
  disabled: boolean;
  beforeMutation: () => Promise<void>;
  onMutationChange: (inProgress: boolean) => void;
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
  const receiptPreviewKey = receipt
    ? `${receipt.originalName}:${receipt.contentType}:${receipt.sizeBytes}`
    : "";
  const [receiptPreview, setReceiptPreview] = useState<{
    key: string;
    href: string;
  } | null>(null);
  const receiptPreviewHref =
    receiptPreview?.key === receiptPreviewKey ? receiptPreview.href : "";

  useEffect(() => {
    let canceled = false;
    if (!receiptPreviewKey) return;

    void getRsvpReceiptPreviewUrl()
      .then(({ previewUrl }) => {
        if (!canceled) {
          setReceiptPreview({
            key: receiptPreviewKey,
            href: previewUrl ?? "",
          });
        }
      })
      .catch(() => {
        if (!canceled) {
          setReceiptPreview({
            key: receiptPreviewKey,
            href: "",
          });
        }
      });

    return () => {
      canceled = true;
    };
  }, [receiptPreviewKey]);

  const handleFile = async (file: File) => {
    if (disabled) return;
    if (!isRsvpReceiptContentType(file.type)) {
      setState("error");
      setMessage("Choose a PDF file.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_RSVP_RECEIPT_SIZE_BYTES) {
      setState("error");
      setMessage("Choose a non-empty file no larger than 20 MB.");
      return;
    }

    const operation = ++operationRef.current;
    onMutationChange(true);
    setState("uploading");
    setMessage("Uploading and verifying receipt...");
    try {
      await beforeMutation();
      const body = new FormData();
      body.append("file", file);
      const result = await uploadRsvpReceipt(body);
      if ("error" in result) {
        throw new Error(result.error);
      }
      if (
        operation !== operationRef.current ||
        getValues("travelPlan") !== "reimbursement"
      ) {
        return;
      }
      setValue("receipt", result.receipt, {
        shouldDirty: true,
        shouldValidate: true,
      });
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

  return (
    <FormQuestion
      label="Travel reimbursement receipt"
      htmlFor="receipt"
      required
      description="Upload 1 PDF file. Max 20 MB."
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
          </div>
          <div className="overflow-hidden rounded-2xl border border-moss/10 bg-white/80">
            <div className="flex items-center justify-between gap-3 border-b border-moss/10 px-4 py-2">
              <p className="font-red-hat text-xs font-medium text-moss/65">
                Receipt preview
              </p>
              <p className="font-red-hat text-[0.7rem] text-moss/45">
                {receipt.contentType}
              </p>
            </div>
            {receiptPreviewHref ? (
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
            ) : (
              <div className="flex min-h-40 items-center justify-center px-4 py-8 text-center font-red-hat text-sm text-moss/55">
                Loading preview...
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Input
          ref={inputRef}
          id="receipt"
          type="file"
          accept={RSVP_RECEIPT_CONTENT_TYPE}
          disabled={disabled || state === "uploading"}
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
