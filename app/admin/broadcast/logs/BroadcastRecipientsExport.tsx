"use client";

import { useTransition } from "react";
import { exportBroadcastRecipientsAction } from "../actions";

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BroadcastRecipientsExport({
  broadcastId,
  deliveredCount,
}: {
  broadcastId: string;
  deliveredCount: number;
}) {
  const [isExporting, startExporting] = useTransition();

  return (
    <button
      type="button"
      className="underline disabled:opacity-50"
      disabled={isExporting}
      onClick={() => {
        startExporting(async () => {
          try {
            const file = await exportBroadcastRecipientsAction(broadcastId);
            downloadTextFile(file.content, file.filename);
          } catch (error) {
            window.alert(
              error instanceof Error
                ? error.message
                : "Could not export recipients.",
            );
          }
        });
      }}
    >
      {isExporting ? "Exporting..." : `${deliveredCount} delivered`}
    </button>
  );
}
