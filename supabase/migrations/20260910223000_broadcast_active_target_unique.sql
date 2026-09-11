CREATE UNIQUE INDEX "broadcast_logs_active_target_unique" ON "broadcast_logs" USING btree ("target") WHERE "broadcast_logs"."status" = 'sending';
