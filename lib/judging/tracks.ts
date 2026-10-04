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

/**
 * MDredd's export with only the rows of projects that entered `track`. Rows
 * are kept byte for byte, so the result matches the full export minus rows.
 */
export function filterExportByTrack(csv: string, track: string): string {
  const [header, ...rows] = csvRecords(csv);
  if (!header) return csv;
  const kept = rows.filter((row) => {
    const attributes = Object.fromEntries(
      header.fields.map((name, index) => [name, row.fields[index] ?? ""]),
    );
    return projectTracks(attributes).includes(track);
  });
  return [header, ...kept].map((record) => `${record.raw}\r\n`).join("");
}

type CsvRecord = { raw: string; fields: string[] };

/** RFC 4180 records, each with its original text. Quoted fields may span lines. */
function csvRecords(csv: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let start = 0;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (csv[i + 1] === '"') field += csv[++i];
      else quoted = false;
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else if (char === "\r" || char === "\n") {
      fields.push(field);
      records.push({ raw: csv.slice(start, i), fields });
      if (char === "\r" && csv[i + 1] === "\n") i++;
      fields = [];
      field = "";
      start = i + 1;
    } else {
      field += char;
    }
  }
  if (start < csv.length) {
    fields.push(field);
    records.push({ raw: csv.slice(start), fields });
  }
  return records;
}
