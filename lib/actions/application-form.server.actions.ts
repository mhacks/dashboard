"use server";
import {
  HackerApplicationFormData,
  JudgeApplicationFormData,
} from "@/lib/types/applications";
import { db } from "@/lib/db";
import {
  hackerApplicants,
  judgeApplicants,
} from "@/lib/db/schema/applications";
import { getTableColumns, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

function conflictUpdateSetAll<TTable extends PgTable>(table: TTable) {
  const columns = getTableColumns(table);

  return Object.keys(columns).reduce(
    (acc, columnName) => {
      const dbColumnName = columns[columnName].name;
      if (columnName !== "userId") {
        acc[columnName] = sql.raw(`excluded.${dbColumnName}`);
      }
      return acc;
    },
    {} as Record<string, any>,
  );
}

export const submitHackerApplication = async (
  userId: string,
  data: HackerApplicationFormData,
) => {
  try {
    await db
      .insert(hackerApplicants)
      .values({ ...data, userId })
      .onConflictDoUpdate({
        target: hackerApplicants.userId,
        set: conflictUpdateSetAll(hackerApplicants),
      });
  } catch (error) {
    console.error("Unable to submit Hacker Application");
    throw error;
  }
};

export const updateHackerApplication = async () => {};

export const updateJudgeApplications = async (
  profileId: string,
  data: JudgeApplicationFormData,
) => {
  try {
    await db.insert(judgeApplicants).values({
      ...data,
      userId: profileId,
    });
  } catch (error) {
    console.error("Unable to update Judge Applications");
    throw error;
  }
};

