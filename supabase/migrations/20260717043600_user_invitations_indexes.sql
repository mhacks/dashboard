CREATE INDEX "user_invitations_email_lower_idx" ON "user_invitations" (lower("email"));
--> statement-breakpoint
CREATE INDEX "user_invitations_created_at_idx" ON "user_invitations" ("created_at" DESC);
