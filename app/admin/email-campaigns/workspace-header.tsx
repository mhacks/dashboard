"use client";

import { useState } from "react";
import { AlertTriangle, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emailCampaignViews } from "./campaign-types";
import type { EmailCampaignSurface } from "./surface";

export function EmailCampaignViewNav({
  activeView,
  onViewChange,
}: {
  activeView: EmailCampaignSurface;
  onViewChange: (view: EmailCampaignSurface) => void;
}) {
  return (
    <nav
      aria-label="Email campaign workspace"
      className="flex shrink-0 flex-nowrap items-center gap-2"
    >
      {emailCampaignViews.map(({ value, label, icon: Icon }) => {
        const active = activeView === value;

        return (
          <Button
            key={value}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            className={cn(!active && "bg-card text-muted-foreground")}
            aria-current={active ? "page" : undefined}
            onClick={() => onViewChange(value)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        );
      })}
    </nav>
  );
}

export function EmailCampaignWorkspaceHeader({
  activeView,
  onViewChange,
  onSave,
  onDelete,
  canDelete,
  templateName,
  busy,
}: {
  activeView: EmailCampaignSurface;
  onViewChange: (view: EmailCampaignSurface) => void;
  onSave: () => void;
  onDelete: () => void;
  canDelete: boolean;
  templateName: string;
  busy: string | null;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const saveBusy =
    activeView === "styles" ? busy === "save-styles" : busy === "save-template";
  const deleteBusy = busy === "delete-template";
  const deleteLabel = templateName.trim() || "this template";

  return (
    <div className="flex h-14 shrink-0 flex-nowrap items-center justify-between gap-3 border-b bg-card px-4">
      <EmailCampaignViewNav
        activeView={activeView}
        onViewChange={onViewChange}
      />
      <div className="flex shrink-0 items-center gap-2">
        {canDelete ? (
          <Button
            className="shrink-0"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteBusy}
          >
            <Trash2 />
            Delete
          </Button>
        ) : null}
        <Button className="shrink-0" onClick={onSave} disabled={saveBusy}>
          <Save />
          Save
        </Button>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteLabel} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
