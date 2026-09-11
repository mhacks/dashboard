"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Meter } from "@/components/ui/meter";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BroadcastDeliveryDetails } from "@/lib/broadcast/log-types";
import { broadcastErrorMessage } from "@/lib/broadcast/config";
import {
  BROADCAST_PAUSED_NOTICE,
  broadcastProgressPercent,
  formatBroadcastOutcome,
  formatBroadcastProgress,
} from "@/lib/broadcast/progress";
import type {
  BroadcastFailure,
  BroadcastSendStatus,
} from "@/lib/broadcast/types";
import { cn } from "@/lib/utils";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CopyIcon,
  ListFilterIcon,
  Loader2Icon,
  RotateCwIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import {
  applyBroadcastRetryResultsAction,
  getBroadcastDeliveryDetailsAction,
  retryFailedBroadcastAction,
  updateBroadcastOmittedAction,
} from "./actions";
import { RecipientSearchField } from "./RecipientSearchField";
import { runBroadcastLoop } from "./run-broadcast-loop";
import { useRecipientSelection } from "./use-recipient-selection";

type DeliveryTab = "failed" | "omitted" | "delivered";

function matchesSearch(value: string, query: string) {
  return query === "" || value.toLowerCase().includes(query);
}

function CopyRecipientButton({ recipient }: { recipient: string }) {
  const [copied, setCopied] = useState(false);

  async function copyRecipient() {
    await navigator.clipboard.writeText(recipient);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 w-7 shrink-0 px-0"
      onClick={() => void copyRecipient()}
      aria-label={copied ? "Copied" : `Copy ${recipient}`}
    >
      {copied ? (
        <CheckCircle2Icon className="size-3.5 text-emerald-600" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </Button>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function FailureDeliveryRow({
  failure,
  selected,
  usingSubset,
  interactive,
  onToggleSelected,
  checkboxLabel,
}: {
  failure: BroadcastFailure;
  selected?: boolean;
  usingSubset?: boolean;
  interactive?: boolean;
  onToggleSelected?: (selected: boolean) => void;
  checkboxLabel: string;
}) {
  return (
    <li
      className={cn(
        "min-w-0 border-b px-3 py-2.5 last:border-b-0",
        interactive && usingSubset && !selected && "bg-muted/20",
      )}
    >
      <div className="flex items-start gap-2">
        {interactive ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onToggleSelected?.(checked === true)}
            className="mt-0.5"
            aria-label={checkboxLabel}
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start gap-1">
            <p
              className={cn(
                "min-w-0 flex-1 break-all text-sm",
                !interactive || !usingSubset || selected
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {failure.recipient}
            </p>
            <CopyRecipientButton recipient={failure.recipient} />
          </div>
          <p className="rounded-md bg-muted/50 px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
            {failure.error}
          </p>
        </div>
      </div>
    </li>
  );
}

function ErrorFilterMenu({
  errorGroups,
  selectedErrors,
  onToggleError,
  onSelectAll,
  onClear,
}: {
  errorGroups: [string, number][];
  selectedErrors: Set<string>;
  onToggleError: (error: string, selected: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const allErrors = errorGroups.map(([error]) => error);
  const allSelected =
    allErrors.length > 0 &&
    allErrors.every((error) => selectedErrors.has(error));

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5"
          aria-haspopup="listbox"
          aria-label="Filter by error"
        >
          <ListFilterIcon className="size-3.5" />
          {selectedErrors.size > 0 ? (
            <span className="text-xs">{selectedErrors.size}</span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="z-[60] w-80 gap-0 overflow-hidden p-0 font-red-hat text-xs"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Filter by error"
      >
        <PopoverHeader className="flex-row items-center justify-between gap-2 border-b px-3 py-2 text-xs">
          <PopoverTitle>Filter by error</PopoverTitle>
          <div className="flex items-center gap-2 text-[11px]">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={allSelected}
              onClick={onSelectAll}
            >
              Select all
            </Button>
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={selectedErrors.size === 0}
              onClick={onClear}
            >
              Clear
            </Button>
          </div>
        </PopoverHeader>
        <div className="max-h-64 overflow-y-auto overscroll-y-contain">
          <ul className="p-1.5">
            {errorGroups.map(([error, count]) => {
              const checked = selectedErrors.has(error);

              return (
                <li key={error}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60",
                      checked && "bg-primary/5",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) =>
                        onToggleError(error, nextChecked === true)
                      }
                      className="mt-0.5"
                      aria-label={`Filter by ${error}`}
                    />
                    <span className="min-w-0 flex-1 break-words leading-relaxed">
                      {error}{" "}
                      <span className="whitespace-nowrap text-muted-foreground">
                        ({count})
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FailureListPanel({
  failures,
  mode,
  interactive,
  selectedRecipients,
  onToggleRecipient,
  onSetSelection,
}: {
  failures: BroadcastFailure[];
  mode: "retry" | "omitted";
  interactive: boolean;
  selectedRecipients: Set<string>;
  onToggleRecipient: (recipient: string, selected: boolean) => void;
  onSetSelection: (recipients: string[]) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const errorFilters = useRecipientSelection();

  const errorGroups = useMemo(() => {
    const groups = new Map<string, number>();

    for (const failure of failures) {
      groups.set(failure.error, (groups.get(failure.error) ?? 0) + 1);
    }

    return Array.from(groups.entries()).sort(
      (left, right) => right[1] - left[1],
    );
  }, [failures]);

  const filteredFailures = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return failures.filter((failure) => {
      if (
        errorFilters.selected.size > 0 &&
        !errorFilters.selected.has(failure.error)
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        matchesSearch(failure.recipient, query) ||
        matchesSearch(failure.error, query)
      );
    });
  }, [errorFilters.selected, failures, searchQuery]);

  const visibleRecipients = filteredFailures.map(
    (failure) => failure.recipient,
  );
  const usingSubset = selectedRecipients.size > 0;
  const selectedVisibleCount = visibleRecipients.filter((recipient) =>
    selectedRecipients.has(recipient),
  ).length;
  const selectedCount = failures.filter((failure) =>
    selectedRecipients.has(failure.recipient),
  ).length;
  const allVisibleSelected =
    visibleRecipients.length > 0 &&
    visibleRecipients.every((recipient) => selectedRecipients.has(recipient));

  function selectVisible() {
    const next = new Set(selectedRecipients);
    for (const recipient of visibleRecipients) {
      next.add(recipient);
    }
    onSetSelection(Array.from(next));
  }

  function deselectVisible() {
    const visibleSet = new Set(visibleRecipients);
    onSetSelection(
      Array.from(selectedRecipients).filter(
        (recipient) => !visibleSet.has(recipient),
      ),
    );
  }

  if (failures.length === 0) {
    return (
      <EmptyPanel>
        {mode === "retry"
          ? "No failed recipients queued for retry."
          : "No omitted recipients."}
      </EmptyPanel>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {interactive ? (
        <div className="shrink-0 rounded-lg border border-muted px-3 py-2 text-xs text-muted-foreground">
          {mode === "retry"
            ? "All failed recipients will be retried by default. Check specific recipients to retry or omit only those."
            : "These recipients will not be retried. Check recipients to move them back to Failed."}
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex gap-2">
          <RecipientSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by recipient or error..."
            className="flex-1"
          />
          {errorGroups.length > 1 ? (
            <ErrorFilterMenu
              errorGroups={errorGroups}
              selectedErrors={errorFilters.selected}
              onToggleError={errorFilters.toggle}
              onSelectAll={() =>
                errorFilters.setRecipients(errorGroups.map(([error]) => error))
              }
              onClear={errorFilters.reset}
            />
          ) : null}
        </div>

        {errorFilters.selected.size > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {errorGroups
              .filter(([error]) => errorFilters.selected.has(error))
              .map(([error, count]) => (
                <button
                  key={error}
                  type="button"
                  onClick={() => errorFilters.toggle(error, false)}
                  className="max-w-full truncate rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-primary/10"
                  title={error}
                >
                  {error} ({count})
                </button>
              ))}
          </div>
        ) : null}
      </div>

      {interactive ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {usingSubset ? (
              <>
                <span className="font-medium text-foreground">
                  {selectedCount}
                </span>{" "}
                of {failures.length} selected
              </>
            ) : mode === "retry" ? (
              <>
                All{" "}
                <span className="font-medium text-foreground">
                  {failures.length}
                </span>{" "}
                will be retried
              </>
            ) : (
              <>Select recipients to move back to Failed</>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={allVisibleSelected || visibleRecipients.length === 0}
              onClick={selectVisible}
            >
              {searchQuery || errorFilters.selected.size > 0
                ? "Select visible"
                : "Select all"}
            </Button>
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={selectedVisibleCount === 0}
              onClick={deselectVisible}
            >
              {searchQuery || errorFilters.selected.size > 0
                ? "Deselect visible"
                : "Deselect all"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        {filteredFailures.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No failures match your search.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filteredFailures.map((failure) => (
              <FailureDeliveryRow
                key={failure.recipient}
                failure={failure}
                selected={selectedRecipients.has(failure.recipient)}
                usingSubset={usingSubset}
                interactive={interactive}
                onToggleSelected={(checked) =>
                  onToggleRecipient(failure.recipient, checked)
                }
                checkboxLabel={
                  mode === "retry"
                    ? `Select ${failure.recipient} for retry or omit`
                    : `Select ${failure.recipient} to move back to Failed`
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeliveredPanel({ recipients }: { recipients: string[] }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRecipients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return recipients;
    }

    return recipients.filter((recipient) => matchesSearch(recipient, query));
  }, [recipients, searchQuery]);

  if (recipients.length === 0) {
    return <EmptyPanel>No successful deliveries yet.</EmptyPanel>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <RecipientSearchField
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search delivered recipients..."
        className="shrink-0"
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        {filteredRecipients.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No delivered recipients match your search.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto text-sm">
            {filteredRecipients.map((recipient) => (
              <li key={recipient} className="flex items-center gap-1 px-3 py-2">
                <span className="min-w-0 flex-1 break-all">{recipient}</span>
                <CopyRecipientButton recipient={recipient} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Skeleton className="h-8 w-full shrink-0 rounded-lg" />
      <Skeleton className="min-h-0 flex-1 w-full rounded-lg" />
    </div>
  );
}

export function BroadcastDeliveryDetails({
  broadcastId,
  children,
}: {
  broadcastId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DeliveryTab>("failed");
  const [details, setDetails] = useState<BroadcastDeliveryDetails | null>(null);
  const retrySelection = useRecipientSelection();
  const omittedSelection = useRecipientSelection();
  const [retryStatus, setRetryStatus] = useState<BroadcastSendStatus | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isSavingOmitted, startSavingOmitted] = useTransition();
  const [isRetrying, startRetrying] = useTransition();

  const canSelectForRetry =
    details?.status === "complete" && details.failedCount > 0;
  const retryFailures = details?.retryFailures ?? [];
  const omittedFailures = details?.omittedFailures ?? [];
  const omittedRecipients = omittedFailures.map((failure) => failure.recipient);
  const failedCount = retryFailures.length;
  const selectedCount = retrySelection.selected.size;
  const selectedOmittedCount = omittedSelection.selected.size;
  const omittedCount = omittedFailures.length;
  const usingSubsetSelection = selectedCount > 0;
  const retryTargetCount = usingSubsetSelection ? selectedCount : failedCount;
  const canMoveSelected =
    activeTab === "failed"
      ? selectedCount > 0
      : activeTab === "omitted"
        ? selectedOmittedCount > 0
        : false;
  const canRetry =
    canSelectForRetry && failedCount > 0 && !isRetrying && !isSavingOmitted;
  const retryInProgress = Boolean(retryStatus && !retryStatus.complete);
  const retryRecipientSet = new Set(
    retryFailures.map((failure) => failure.recipient),
  );

  function persistOmitted(omittedTo: string[]) {
    setError(null);
    startSavingOmitted(async () => {
      try {
        const result = await updateBroadcastOmittedAction({
          broadcastId,
          omittedTo,
        });
        setDetails(result);
        router.refresh();
        retrySelection.pruneToRecipients(
          result.retryFailures.map((failure) => failure.recipient),
        );
        omittedSelection.pruneToRecipients(
          result.omittedFailures.map((failure) => failure.recipient),
        );
      } catch (saveError) {
        setError(
          broadcastErrorMessage(
            saveError,
            "Could not update omitted recipients.",
          ),
        );
      }
    });
  }

  function omitRecipients(recipients: string[]) {
    if (recipients.length === 0) {
      return;
    }

    persistOmitted([...new Set([...omittedRecipients, ...recipients])]);
  }

  function includeRecipients(recipients: string[]) {
    if (recipients.length === 0) {
      return;
    }

    const removeSet = new Set(recipients);
    persistOmitted(
      omittedRecipients.filter((recipient) => !removeSet.has(recipient)),
    );
  }

  function moveSelectedRecipients() {
    if (activeTab === "failed") {
      omitRecipients(Array.from(retrySelection.selected));
      return;
    }

    if (activeTab === "omitted") {
      includeRecipients(Array.from(omittedSelection.selected));
    }
  }

  function recipientsToRetry() {
    if (retrySelection.selected.size > 0) {
      return Array.from(retrySelection.selected).filter((recipient) =>
        retryRecipientSet.has(recipient),
      );
    }

    return retryFailures.map((failure) => failure.recipient);
  }

  function loadDetails() {
    setError(null);
    startLoading(async () => {
      try {
        const result = await getBroadcastDeliveryDetailsAction(broadcastId);
        setDetails(result);
        setActiveTab(
          result.retryFailures.length > 0
            ? "failed"
            : result.omittedFailures.length > 0
              ? "omitted"
              : "delivered",
        );
        retrySelection.reset();
        omittedSelection.reset();
      } catch (loadError) {
        setDetails(null);
        retrySelection.reset();
        omittedSelection.reset();
        setError(
          broadcastErrorMessage(loadError, "Could not load delivery details."),
        );
      }
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isRetrying || isSavingOmitted) {
      return;
    }

    setOpen(nextOpen);

    if (nextOpen) {
      loadDetails();
      return;
    }

    setDetails(null);
    retrySelection.reset();
    omittedSelection.reset();
    setError(null);
    setRetryNotice(null);
    setRetryStatus(null);
    setActiveTab("failed");
  }

  function startRetry() {
    if (!details || failedCount === 0) {
      return;
    }

    const recipients = recipientsToRetry();

    if (recipients.length === 0) {
      return;
    }

    setRetryNotice(null);
    setError(null);

    startRetrying(async () => {
      try {
        const started = await retryFailedBroadcastAction({
          broadcastId,
          recipients,
        });
        setRetryStatus(started.status);

        const finalStatus = await runBroadcastLoop(
          started.status,
          (currentStatus) => {
            setRetryStatus(currentStatus);
          },
        );

        setRetryStatus(finalStatus);

        if (finalStatus.complete) {
          const updatedDetails = await applyBroadcastRetryResultsAction({
            originalBroadcastId: broadcastId,
            retryBroadcastId: started.broadcastId,
          });
          setDetails(updatedDetails);
          setRetryNotice(
            formatBroadcastOutcome(
              finalStatus.sentCount,
              finalStatus.failedCount,
              {
                finishedLabel: "Retry",
                successMessage: `Retry delivered to ${finalStatus.sentCount} recipients.`,
              },
            ),
          );
          router.refresh();
          return;
        }

        setRetryNotice(BROADCAST_PAUSED_NOTICE);
      } catch (retryError) {
        setRetryStatus(null);
        setError(
          broadcastErrorMessage(
            retryError,
            "Could not retry failed deliveries.",
          ),
        );
      }
    });
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
        <AlertDialogContent className="!flex h-[85vh] max-h-[92vh] w-[min(96rem,calc(100vw-2rem))] !max-w-none flex-col gap-0 overflow-hidden p-0">
          <AlertDialogTitle className="sr-only">
            Broadcast delivery results
          </AlertDialogTitle>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <AlertDialogCancel
              disabled={isRetrying || isSavingOmitted}
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-10 size-8"
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </AlertDialogCancel>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-12 pb-4">
              {retryInProgress && retryStatus ? (
                <div className="mb-3 shrink-0 space-y-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">
                      Retry in progress
                    </span>
                    <span className="text-muted-foreground">
                      {formatBroadcastProgress(retryStatus, {
                        separator: " · ",
                      })}
                    </span>
                  </div>
                  <Meter
                    value={broadcastProgressPercent(retryStatus)}
                    className="h-1.5"
                  />
                </div>
              ) : null}

              {retryNotice ? (
                <div className="mb-3 shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-muted-foreground">
                  {retryNotice}
                </div>
              ) : null}

              {error ? (
                <div className="mb-3 shrink-0 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              ) : null}

              {isLoading && !details ? <LoadingState /> : null}

              {details ? (
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => setActiveTab(value as DeliveryTab)}
                  className="flex min-h-0 flex-1 flex-col gap-3"
                >
                  <TabsList className="w-full shrink-0">
                    <TabsTrigger value="failed" className="flex-1">
                      Failed ({failedCount})
                    </TabsTrigger>
                    <TabsTrigger value="omitted" className="flex-1">
                      Omitted ({omittedCount})
                    </TabsTrigger>
                    <TabsTrigger value="delivered" className="flex-1">
                      Delivered ({details.sentCount})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="failed"
                    className="mt-0 flex min-h-0 flex-1 flex-col"
                  >
                    <FailureListPanel
                      failures={retryFailures}
                      mode="retry"
                      interactive={
                        canSelectForRetry && !isRetrying && !isSavingOmitted
                      }
                      selectedRecipients={retrySelection.selected}
                      onToggleRecipient={retrySelection.toggle}
                      onSetSelection={retrySelection.setRecipients}
                    />
                  </TabsContent>

                  <TabsContent
                    value="omitted"
                    className="mt-0 flex min-h-0 flex-1 flex-col"
                  >
                    <FailureListPanel
                      failures={omittedFailures}
                      mode="omitted"
                      interactive={
                        canSelectForRetry && !isRetrying && !isSavingOmitted
                      }
                      selectedRecipients={omittedSelection.selected}
                      onToggleRecipient={omittedSelection.toggle}
                      onSetSelection={omittedSelection.setRecipients}
                    />
                  </TabsContent>

                  <TabsContent
                    value="delivered"
                    className="mt-0 flex min-h-0 flex-1 flex-col"
                  >
                    <DeliveredPanel recipients={details.deliveredTo} />
                  </TabsContent>
                </Tabs>
              ) : null}

              {details && details.pendingCount > 0 ? (
                <p className="mt-3 shrink-0 text-xs text-muted-foreground">
                  {details.pendingCount} recipient
                  {details.pendingCount === 1 ? "" : "s"} still pending
                  delivery.
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 px-5 py-4">
              {canSelectForRetry ? (
                <p className="text-xs text-muted-foreground">
                  {activeTab === "omitted"
                    ? selectedOmittedCount > 0
                      ? "Move checked recipients back to Failed to include them in the retry."
                      : "Select recipients to move back to Failed."
                    : failedCount === 0
                      ? "No failed recipients remain."
                      : usingSubsetSelection
                        ? "Only checked recipients will be retried or omitted."
                        : `All ${retryTargetCount} failed recipients will be retried.`}
                </p>
              ) : (
                <span />
              )}

              {canSelectForRetry ? (
                <div className="flex items-center gap-2">
                  {activeTab !== "delivered" ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        !canMoveSelected || isRetrying || isSavingOmitted
                      }
                      onClick={moveSelectedRecipients}
                    >
                      {isSavingOmitted ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          Saving...
                        </>
                      ) : activeTab === "failed" ? (
                        <>
                          Omit selected
                          <ArrowRightIcon className="size-4" />
                        </>
                      ) : (
                        <>
                          <Undo2Icon className="size-4" />
                          Include selected
                        </>
                      )}
                    </Button>
                  ) : null}
                  {activeTab === "failed" ? (
                    <Button
                      type="button"
                      disabled={!canRetry}
                      onClick={startRetry}
                    >
                      {isRetrying ? (
                        <>
                          <Loader2Icon className="size-4 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RotateCwIcon className="size-4" />
                          {usingSubsetSelection
                            ? "Retry selected"
                            : "Retry all"}
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
