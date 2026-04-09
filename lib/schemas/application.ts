import { HackerApplicationFormData } from "@/lib/types/applications";

// * DB STUFF TYPE

// TODO link up with Drizzle type

export type HackerApplicant = HackerApplicationFormData & {
  id: string; // * row identifier
  user_id: string; // * id from profile when signup
  name: string; // * name from profile when signup
  status: string;
};
