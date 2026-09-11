"use server";

import { listBroadcastTargetSummaries } from "@/lib/broadcast/registry";
import {
  findActiveBroadcast,
  getBroadcastDeliveryDetails,
  sendBroadcastBatch,
  startBroadcast,
} from "@/lib/broadcast/service";

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
