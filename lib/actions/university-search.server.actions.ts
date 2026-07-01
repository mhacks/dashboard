"use server";

import { createClient } from "@/lib/supabase/server";
import {
  searchUniversities as searchUniversityDataset,
  type UniversitySearchResult,
} from "@/lib/universities/search";

export async function searchUniversities(
  query: string,
): Promise<UniversitySearchResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  return searchUniversityDataset(query);
}
