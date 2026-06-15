"use server";
import {
  HackerApplicationFormData,
  JudgeApplicationFormData,
} from "@/lib/types/applications";
import { db } from "@/lib/db";
import { hackerApplicants, judgeApplicants } from "@/lib/db/schema";

export const submitHackerApplication = async (
  profileId: string,
  data: HackerApplicationFormData,
) => {
  try {
    await db.insert(hackerApplicants).values({
      ...data,
      userId: profileId,
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

const uploadResume = async (profileId: string, file: File): Promise<string> => {
  // TODO: Implement S3 upload
  console.log("Uploading resume:", file.name);
  return "dummy-resume-url";
};
