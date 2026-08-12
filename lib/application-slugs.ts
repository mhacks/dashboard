import { sql } from "drizzle-orm";
import { z } from "zod";

import { hackerApplicants } from "@/lib/db/schema/applications";

export const applicationSlugSchema = z
  .string()
  .regex(/^app_[a-f0-9]{24}$/u, "Invalid application slug");

export const applicationSlugSql = sql<string>`'app_' || substring(md5(${hackerApplicants.userId}::text) from 1 for 24)`;
