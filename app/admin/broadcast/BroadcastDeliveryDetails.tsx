"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { BroadcastDeliveryDetails } from "@/lib/broadcast/log-types";
import { getBroadcastDeliveryDetailsAction } from "./actions";

function summaryLabel(details: BroadcastDeliveryDetails) {
  const parts = [`${details.sentCount} sent`, `${details.failedCount} failed`];

  if (details.pendingCount > 0) {
    parts.push(`${details.pendingCount} pending`);
  }

  return parts.join(" · ");
}

function DeliveryList({
  title,
  emptyMessage,
  items,
  renderItem,
}: {
  title: string;
  emptyMessage: string;
  items: string[] | BroadcastDeliveryDetails["failures"];
  renderItem: (item: (typeof items)[number], index: number) => React.ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden">
      <h3 className="mb-1.5 text-xs font-medium text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="max-h-36 overflow-x-hidden overflow-y-auto rounded-md border">
          <ul className="divide-y text-xs">
            {items.map((item, index) => (
              <li key={index} className="min-w-0 px-2.5 py-1.5">
                {renderItem(item, index)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function BroadcastDeliveryDetails({
  broadcastId,
  children,
}: {
  broadcastId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<BroadcastDeliveryDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  function loadDetails() {
    setError(null);
    startLoading(async () => {
      try {
        const result = await getBroadcastDeliveryDetailsAction(broadcastId);
        setDetails(result);
      } catch (loadError) {
        setDetails(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load delivery details.",
        );
      }
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      loadDetails();
      return;
    }

    setDetails(null);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex border-0 bg-transparent p-0"
        onClick={() => handleOpenChange(true)}
      >
        {children}
      </button>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-lg flex-col gap-4 overflow-hidden sm:max-w-lg">
          <AlertDialogHeader className="shrink-0 place-items-start text-left">
            <AlertDialogTitle>Delivery details</AlertDialogTitle>
            <AlertDialogDescription>
              {isLoading && !details
                ? "Loading delivery results..."
                : error
                  ? error
                  : details
                    ? summaryLabel(details)
                    : "No delivery details available."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {details && !error ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <DeliveryList
                title={`Delivered (${details.sentCount})`}
                emptyMessage="No successful deliveries yet."
                items={details.deliveredTo}
                renderItem={(recipient) => (
                  <span className="break-all text-foreground">{recipient}</span>
                )}
              />

              <DeliveryList
                title={`Failed (${details.failedCount})`}
                emptyMessage="No failed deliveries."
                items={details.failures}
                renderItem={(failure) => (
                  <div className="min-w-0 space-y-0.5">
                    <p className="break-all text-foreground">
                      {failure.recipient}
                    </p>
                    <p className="break-words text-muted-foreground">
                      {failure.error}
                    </p>
                  </div>
                )}
              />

              {details.pendingCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {details.pendingCount} recipient
                  {details.pendingCount === 1 ? "" : "s"} still pending.
                </p>
              ) : null}

              {details.status === "sending" &&
              details.failedCount > details.failures.length ? (
                <p className="text-xs text-muted-foreground">
                  Showing the most recent failure details while delivery is in
                  progress.
                </p>
              ) : null}
            </div>
          ) : null}

          <AlertDialogFooter className="shrink-0">
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
