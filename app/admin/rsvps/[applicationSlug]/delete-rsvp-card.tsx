"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAdminRsvpAction } from "@/lib/actions/admin-rsvps.server.actions";

export function DeleteRsvpCard({
  applicationSlug,
  applicationName,
  accountEmail,
  submittedAt,
}: {
  applicationSlug: string;
  applicationName: string;
  accountEmail: string;
  submittedAt: string | null;
}) {
  const router = useRouter();
  const [confirmationName, setConfirmationName] = useState("");
  const [isPending, startTransition] = useTransition();
  const canDelete = confirmationName.trim() === applicationName;

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="text-destructive">Delete RSVP</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            This deletes the submitted RSVP for {applicationName} and moves the
            applicant back to accepted.
          </p>
          <p>
            {accountEmail}
            {submittedAt
              ? ` · submitted ${new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(submittedAt))}`
              : ""}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="delete-rsvp-confirmation">
            Type {applicationName} to confirm
          </Label>
          <Input
            id="delete-rsvp-confirmation"
            value={confirmationName}
            onChange={(event) => setConfirmationName(event.target.value)}
            disabled={isPending}
            autoComplete="off"
          />
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={!canDelete || isPending}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete RSVP
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <AlertTriangleIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>Delete this RSVP?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the submitted RSVP for{" "}
                {applicationName}. The applicant will need to submit RSVP
                details again if they are still attending.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={(event) => {
                  event.preventDefault();
                  startTransition(async () => {
                    const result = await deleteAdminRsvpAction({
                      slug: applicationSlug,
                      confirmationName,
                    });

                    if (!result.ok) {
                      toast.error(result.message);
                      return;
                    }

                    toast.success(`Deleted ${result.applicationName}'s RSVP.`);
                    router.push("/admin/rsvps");
                    router.refresh();
                  });
                }}
              >
                Delete RSVP
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
