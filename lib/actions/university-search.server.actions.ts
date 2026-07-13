"use server";

import { requireSessionUser } from "@/lib/auth/guards";
import {
  searchUniversities as searchUniversityDataset,
  type UniversitySearchResult,
} from "@/lib/universities/search";

export async function searchUniversities(
  query: string,
): Promise<UniversitySearchResult[]> {
  await requireSessionUser();

  return searchUniversityDataset(query);
}
