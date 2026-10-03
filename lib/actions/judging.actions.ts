"use server";

import { requireJudgingStaff } from "@/lib/auth/guards";
import { presentPair, presentRow } from "@/lib/judging/display";
import {
  failureFromUnknown,
  getProjects,
  MdreddError,
  requestPair,
  submitComparison,
} from "@/lib/judging/mdredd";
import type {
  ActionFailure,
  ActionSuccess,
  JudgingPair,
  JudgingRow,
} from "@/lib/judging/types";

function integerId(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export async function loadJudgingPair(): Promise<
  ActionSuccess<{ pair: JudgingPair }> | ActionFailure
> {
  try {
    const user = await requireJudgingStaff();
    const pair = presentPair(await requestPair(user.id, []));
    return { ok: true, pair };
  } catch (error) {
    return failureFromUnknown(error);
  }
}

export async function chooseJudgingWinner(
  entityIds: [number, number],
  winnerId: number,
): Promise<ActionSuccess<{ pair: JudgingPair }> | ActionFailure> {
  try {
    const user = await requireJudgingStaff();
    if (
      entityIds.length !== 2 ||
      !entityIds.every(integerId) ||
      !integerId(winnerId) ||
      !entityIds.includes(winnerId)
    ) {
      return {
        ok: false,
        error: "Pick one of the two projects as the winner.",
      };
    }
    await submitComparison(user.id, entityIds, winnerId);
    const pair = presentPair(await requestPair(user.id, []));
    return { ok: true, pair };
  } catch (error) {
    if (
      error instanceof MdreddError &&
      error.code === "JUDGE_DOES_NOT_OWN_PAIR"
    ) {
      try {
        const user = await requireJudgingStaff();
        const pair = presentPair(await requestPair(user.id, []));
        return { ok: true, pair };
      } catch (retryError) {
        return failureFromUnknown(retryError);
      }
    }
    return failureFromUnknown(error);
  }
}

export async function reportJudgingAbsence(
  absent: number[],
): Promise<ActionSuccess<{ pair: JudgingPair }> | ActionFailure> {
  try {
    const user = await requireJudgingStaff();
    if (absent.length < 1 || absent.length > 2 || !absent.every(integerId)) {
      return { ok: false, error: "Mark one or both of the projects absent." };
    }
    const pair = presentPair(await requestPair(user.id, absent));
    return { ok: true, pair };
  } catch (error) {
    return failureFromUnknown(error);
  }
}

export async function listJudgingProjects(): Promise<
  ActionSuccess<{ projects: JudgingRow[] }> | ActionFailure
> {
  try {
    await requireJudgingStaff();
    return { ok: true, projects: (await getProjects()).map(presentRow) };
  } catch (error) {
    return failureFromUnknown(error);
  }
}
