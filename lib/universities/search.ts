import "server-only";

import universities from "@/data/world_universities_and_domains.json";

type HipoUniversity = {
  name: string;
  country: string;
  domains: string[];
};

export type UniversitySearchResult = {
  name: string;
  country: string;
  domains: string[];
};

const MAX_RESULTS = 20;

const universityAliases: Record<string, string[]> = {
  "Arizona State University": ["asu"],
  "Boston University": ["bu"],
  "Brigham Young University": ["byu"],
  "California Institute of Technology": ["caltech"],
  "Carnegie Mellon University": ["cmu"],
  "Case Western Reserve University": ["case", "cwru"],
  "Florida Atlantic University": ["fau"],
  "Florida International University": ["fiu"],
  "Florida State University": ["fsu"],
  "George Mason University": ["gmu"],
  "George Washington University": ["gwu"],
  "Georgia Institute of Technology": ["gatech", "georgia tech", "gt"],
  "Indiana University - Bloomington": ["iu", "iub"],
  "Iowa State University": ["iowa state", "isu"],
  "Johns Hopkins University": ["hopkins", "jhu"],
  "Kansas State University": ["ksu"],
  "Louisiana State University": ["lsu"],
  "Massachusetts Institute of Technology": ["mit"],
  "Michigan State University": ["michigan state", "msu"],
  "Michigan Technological University": ["michigan tech", "mtu"],
  "New Jersey Institute of Technology": ["njit"],
  "New York University": ["nyu"],
  "North Carolina State University": ["nc state", "ncsu"],
  "Northeastern University": ["neu", "northeastern"],
  "Northwestern University": ["northwestern", "nu"],
  "Ohio State University - Columbus": ["ohio state", "osu"],
  "Oregon State University": ["oregon state"],
  "Pennsylvania State University": ["penn state", "psu"],
  "Rensselaer Polytechnic Institute": ["rensselaer", "rpi"],
  "Rochester Institute of Technology": ["rit"],
  "Rutgers University": ["rutgers", "ru"],
  "Stanford University": ["stanford"],
  "State University of New York at Stony Brook": ["sbu", "stony brook"],
  "Texas A&M University - College Station": [
    "tamu",
    "texas a m",
    "texas a and m",
  ],
  "The University of Texas at Austin": ["ut", "ut austin", "utaustin"],
  "University of California, Berkeley": [
    "berkeley",
    "ucb",
    "ucberkeley",
    "ucberekely",
    "ucberekeley",
    "ucberkley",
  ],
  "University of California, Davis": ["uc davis", "ucd", "ucdavis"],
  "University of California, Irvine": ["uci", "uc irvine"],
  "University of California, Los Angeles": ["ucla", "uc los angeles"],
  "University of California, San Diego": ["uc san diego", "ucsd"],
  "University of California, Santa Barbara": ["uc santa barbara", "ucsb"],
  "University of California, Santa Cruz": ["uc santa cruz", "ucsc"],
  "University of Central Florida": ["ucf"],
  "University of Chicago": ["uchicago", "u chicago"],
  "University of Colorado at Boulder": ["cu boulder", "colorado boulder"],
  "University of Connecticut": ["uconn"],
  "University of Delaware": ["udel"],
  "University of Florida": ["uf", "ufl"],
  "University of Georgia": ["uga"],
  "University of Illinois Chicago": ["uic"],
  "University of Illinois Urbana-Champaign": [
    "uiuc",
    "illinois",
    "urbana champaign",
  ],
  "University of Iowa": ["uiowa"],
  "University of Kansas": ["ku"],
  "University of Maryland, College Park": ["umd"],
  "University of Massachusetts at Amherst": ["umass", "umass amherst"],
  "University of Michigan - Ann Arbor": ["michigan", "u m", "umich"],
  "University of Minnesota": ["umn", "minnesota"],
  "University of North Carolina at Chapel Hill": ["chapel hill", "unc"],
  "University of Oregon": ["uo", "uoregon"],
  "University of Pennsylvania": ["penn", "upenn"],
  "University of Pittsburgh": ["pitt", "upitt"],
  "University of Rochester": ["rochester"],
  "University of South Florida": ["usf"],
  "University of Southern California": ["usc"],
  "University of Virginia, Charlottesville": ["uva"],
  "University of Washington": ["uw", "uwash"],
  "University of Wisconsin - Madison": ["uw madison", "uwisc", "wisc"],
  "Virginia Tech": ["vt", "vtech"],
  "Washington University, Saint Louis": ["washu", "wustl"],
  "Western Michigan University": ["wmu"],
  "Worcester Polytechnic Institute": ["wpi"],
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const rawUniversities = universities as HipoUniversity[];

const searchableUniversities = rawUniversities.map((university) => {
  const searchableText = normalize(
    [university.name, university.country, ...university.domains]
      .filter(Boolean)
      .join(" "),
  );

  return {
    result: {
      name: university.name,
      country: university.country,
      domains: university.domains,
    } satisfies UniversitySearchResult,
    aliases: (universityAliases[university.name] ?? []).map(normalize),
    normalizedName: normalize(university.name),
    searchableText,
  };
});

function scoreUniversity(
  university: (typeof searchableUniversities)[number],
  normalizedQuery: string,
  queryTokens: string[],
) {
  const { normalizedName, searchableText } = university;
  const matchingAlias = university.aliases.find(
    (alias) => alias === normalizedQuery,
  );
  const prefixAlias = university.aliases.find((alias) =>
    alias.startsWith(normalizedQuery),
  );
  const domainMatch = university.result.domains.some((domain) =>
    normalize(domain).startsWith(normalizedQuery),
  );

  if (matchingAlias) return 1100;
  if (normalizedName === normalizedQuery) return 1000;
  if (normalizedName.startsWith(normalizedQuery)) return 900;
  if (domainMatch) return 850;
  if (prefixAlias) return 825;
  if (normalizedName.includes(` ${normalizedQuery}`)) return 800;
  if (normalizedName.includes(normalizedQuery)) return 700;

  let score = 0;
  for (const token of queryTokens) {
    if (normalizedName.split(" ").some((word) => word.startsWith(token))) {
      score += 95;
    } else if (normalizedName.includes(token)) {
      score += 70;
    } else if (searchableText.includes(token)) {
      score += 25;
    } else {
      return -1;
    }
  }

  if (university.result.country === "United States") score += 8;
  if (university.result.country === "Canada") score += 4;

  return score;
}

export function searchUniversities(query: string): UniversitySearchResult[] {
  const normalizedQuery = normalize(query.trim());

  if (normalizedQuery.length < 2) return [];

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  return searchableUniversities
    .map((university) => ({
      university,
      score: scoreUniversity(university, normalizedQuery, queryTokens),
    }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.university.result.name.localeCompare(b.university.result.name);
    })
    .slice(0, MAX_RESULTS)
    .map(({ university }) => university.result);
}
