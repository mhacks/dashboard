import { HackerApplicationFormData } from "@/lib/types/applications";

// * DB STUFF TYPE

// TODO link up with Drizzle type

export type HackerApplicant = HackerApplicationFormData & {
  id: string; // * row identifier
  user_id: string; // ? foreign key constraint with user.id
  name: string; // ? foreign key constraint with user.name
  email: string; // ? foreign key constraint with user.email
  status: string;
};
