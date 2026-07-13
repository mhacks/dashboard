"use server";

import {
  searchUniversities as searchUniversityDataset,
  type UniversitySearchResult,
} from "@/lib/universities/search";

export async function searchUniversities(
  query: string,
): Promise<UniversitySearchResult[]> {
  return searchUniversityDataset(query);
}
