"use server";

import {
  applyBroadcastRetryResults,
  findActiveBroadcast,
  getBroadcastDeliveryDetails,
  listBroadcastTargetRecipients,
  markBroadcastDeliveriesFailed,
  retryFailedBroadcast,
  sendBroadcastBatch,
  startBroadcast,
  updateBroadcastOmitted,
} from "@/lib/broadcast/service";
import type { BroadcastLogsFilter } from "@/lib/broadcast/log-types";
import { listBroadcastLogs } from "@/lib/queries/broadcast-logs";

export async function startBroadcastAction(input: unknown) {
  return startBroadcast(input);
}

export async function listBroadcastTargetRecipientsAction(targetId: string) {
  return listBroadcastTargetRecipients(targetId);
}

export async function sendBroadcastBatchAction(input: unknown) {
  return sendBroadcastBatch(input);
}

export async function findActiveBroadcastAction() {
  return findActiveBroadcast();
}

export async function getBroadcastDeliveryDetailsAction(broadcastId: string) {
  return getBroadcastDeliveryDetails(broadcastId);
}

export async function retryFailedBroadcastAction(input: unknown) {
  return retryFailedBroadcast(input);
}

export async function updateBroadcastOmittedAction(input: unknown) {
  return updateBroadcastOmitted(input);
}

export async function markBroadcastDeliveriesFailedAction(input: unknown) {
  return markBroadcastDeliveriesFailed(input);
}

export async function applyBroadcastRetryResultsAction(input: unknown) {
  return applyBroadcastRetryResults(input);
}

export async function listBroadcastLogsAction(
  pageIndex: number,
  pageSize: number,
  filter: BroadcastLogsFilter = {},
  options?: { includeCount?: boolean },
) {
  return listBroadcastLogs(pageIndex, pageSize, filter, options);
}
