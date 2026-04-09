"use server";
import { HackerApplicant } from "@/lib/schemas/application";
import {
  HackerApplicationFormData,
  JudgeApplicationFormData,
} from "@/lib/types/applications";

export const submitHackerApplication = async (
  profileId: string,
  data: HackerApplicationFormData,
) => {
  try {
    // TODODODO do sum here

    // * Hopefully db will automatically assign an id
    const applicant: Partial<HackerApplicant> = {
      ...data,
      user_id: profileId,
      status: "pending",
    };
  } catch (error) {
    console.error("Unable to update Hacker Applications");
    throw error;
  }
};

export const updateJudgeApplications = async (
  profileId: string,
  data: JudgeApplicationFormData,
) => {
  // TODODO do sum here

  try {
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
