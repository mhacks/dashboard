import { HackerApplicationFormData } from "@/lib/types/applications";
import { ProfileRow } from "@/lib/db/schema";

export type HackerApplicant = HackerApplicationFormData & {
  id: string;
  userId: string;
  status: string;
  profile: ProfileRow;
};
