// Columns of the Devpost projects export that name a project's tracks.
const MAIN_TRACK = "M Hacks Main Track";
const SPONSOR_PRIZES = "Sponsor Opt In Prizes";

/**
 * The tracks a project entered: its main track and every sponsor prize it
 * opted into.
 *
 * Mirrors `tracks` in MDredd's app/project.py, so the tracks shown here match
 * the ones judges see on each pair.
 */
export function projectTracks(attributes: Record<string, string>): string[] {
  // Devpost writes the opted-in prizes as a list: "A", "A and B", or
  // "A, B, and C".
  const listed = attributes[SPONSOR_PRIZES] ?? "";
  let prizes = listed.split(", ");
  if (prizes.length > 1) {
    prizes[prizes.length - 1] = prizes[prizes.length - 1].replace(/^and /, "");
  } else {
    prizes = listed.split(" and ");
  }
  const named = [attributes[MAIN_TRACK] ?? "", ...prizes];
  return named.map((track) => track.trim()).filter(Boolean);
}
