CREATE UNIQUE INDEX "team_invitations_pending_team_invitee_uidx" ON "team_invitations" USING btree ("team_id","invited_user_id") WHERE "status" = 'pending';
