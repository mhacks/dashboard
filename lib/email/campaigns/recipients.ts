const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRecipient {
  email: string;
  mergeData: Record<string, string>;
}

export interface ParsedRecipients {
  recipients: ParsedRecipient[];
  emails: string[];
  invalid: string[];
  duplicateCount: number;
  columns: string[];
}

export function parseRecipientText(input: string): ParsedRecipients {
  if (looksLikeCsv(input)) {
    return parseRecipientCsv(input);
  }

  const tokens = input
    .split(/[\n,;\t ]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  const emails: string[] = [];
  const recipients: ParsedRecipient[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const token of tokens) {
    const normalized = token.replace(/^<|>$/g, "");

    if (!emailPattern.test(normalized)) {
      invalid.push(token);
      continue;
    }

    if (seen.has(normalized)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(normalized);
    emails.push(normalized);
    recipients.push({
      email: normalized,
      mergeData: mergeDataForEmail(normalized),
    });
  }

  return { recipients, emails, invalid, duplicateCount, columns: ["email"] };
}

export function mergeDataForEmail(email: string) {
  return {
    email,
    name: readableNameFromEmail(email),
  };
}

function readableNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "there";
  const name = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return name || "there";
}

function looksLikeCsv(input: string) {
  const [firstLine = ""] = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!firstLine.includes(",")) {
    return false;
  }

  return parseCsvLine(firstLine).some(
    (header) => normalizeColumnName(header) === "email",
  );
}

function parseRecipientCsv(input: string): ParsedRecipients {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
  const [headerRow, ...dataRows] = rows;
  const columns = headerRow.map(normalizeColumnName);
  const emailIndex = columns.indexOf("email");
  const recipients: ParsedRecipient[] = [];
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  if (emailIndex < 0) {
    return {
      recipients,
      emails,
      invalid: ["Missing email column"],
      duplicateCount,
      columns,
    };
  }

  for (const [rowIndex, row] of dataRows.entries()) {
    const normalizedEmail = (row[emailIndex] ?? "").trim().toLowerCase();

    if (!emailPattern.test(normalizedEmail)) {
      invalid.push(`Row ${rowIndex + 2}: ${row[emailIndex] ?? ""}`);
      continue;
    }

    if (seen.has(normalizedEmail)) {
      duplicateCount += 1;
      continue;
    }

    const mergeData: Record<string, string> =
      mergeDataForEmail(normalizedEmail);

    for (const [columnIndex, column] of columns.entries()) {
      if (!column) continue;
      mergeData[column] = (row[columnIndex] ?? "").trim();
    }

    mergeData.email = normalizedEmail;
    if (!mergeData.name) {
      mergeData.name = mergeDataForEmail(normalizedEmail).name;
    }

    seen.add(normalizedEmail);
    emails.push(normalizedEmail);
    recipients.push({ email: normalizedEmail, mergeData });
  }

  return { recipients, emails, invalid, duplicateCount, columns };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeColumnName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]/g, "");
}
