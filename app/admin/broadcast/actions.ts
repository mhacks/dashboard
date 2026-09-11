"use server";

import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import {
  applyBroadcastRetryResults,
  findActiveBroadcast,
  getBroadcastDeliveryDetails,
  retryFailedBroadcast,
  sendBroadcastBatch,
  startBroadcast,
  updateBroadcastOmitted,
} from "@/lib/broadcast/service";
import {
  listBroadcastLogs,
  type BroadcastLogsFilter,
} from "@/lib/queries/broadcast-logs";

export async function listBroadcastTargetsAction() {
  return listBroadcastTargetSummaries();
}

export async function startBroadcastAction(input: unknown) {
  return startBroadcast(input);
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

export async function applyBroadcastRetryResultsAction(input: unknown) {
  return applyBroadcastRetryResults(input);
}

export async function listBroadcastLogsAction(
  pageIndex: number,
  pageSize: number,
  filter?: BroadcastLogsFilter,
) {
  return listBroadcastLogs(pageIndex, pageSize, filter);
}
