import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import {
  detectSubmissionUrlHeader,
  detectTrackHeader,
  detectTitleHeader,
} from "./columns.ts";
import { csvTable, parseCsv, serializeCsv } from "./csv.ts";

test("parseCsv keeps quoted commas, quotes, and newlines", () => {
  const rows = parseCsv(
    'Project Title,Notes\r\n"MBath, room","line one\r\nline ""two"""\r\n',
  );
  assert.deepEqual(rows, [
    ["Project Title", "Notes"],
    ["MBath, room", 'line one\r\nline "two"'],
  ]);
});

test("csvTable renames blank and duplicate headers", () => {
  const duplicated = csvTable("Name,Name\nA,B\nC,D\n");
  assert.deepEqual(duplicated.headers, ["Name", "Name_2"]);
  assert.equal(duplicated.records[0]?.Name_2, "B");
  const blank = csvTable("Name,\nA,B\nC,D\n");
  assert.deepEqual(blank.headers, ["Name", "unnamed_2"]);
  assert.equal(blank.records[1]?.unnamed_2, "D");
  assert.throws(() => csvTable("Name\nOnly one\n"), /at least two projects/i);
});

test("round trip preserves a submission url and a multiline note", () => {
  const table = csvTable(
    'Project Title,Submission Url,Notes\nAlpha,https://x.devpost.com/submissions/1,"hello\nthere"\nBeta,https://x.devpost.com/submissions/2,plain\n',
  );
  const again = csvTable(serializeCsv(table.headers, table.records));
  assert.equal(again.records[0]?.Notes, "hello\nthere");
  assert.equal(again.records.length, 2);
});

test("detects Devpost export headers, including a quoted try-it-out column", () => {
  const [headers] = parseCsv(
    'Project Title,Submission Url,Judging Status,"""Try it out"" Links",M Hacks Main Track\n',
  );
  assert.ok(headers);
  assert.equal(detectSubmissionUrlHeader(headers), "Submission Url");
  assert.equal(detectTitleHeader(headers), "Project Title");
  assert.equal(detectTrackHeader(headers), "M Hacks Main Track");
  assert.equal(
    headers.find((header) => header.includes("Try it out")),
    '"Try it out" Links',
  );
});

test("prefers an exact Track header over a longer track-like name", () => {
  assert.equal(
    detectTrackHeader(["Sponsor Track Notes", "Track", "Judging Status"]),
    "Track",
  );
});

test("parses the sample Devpost export when it is available", () => {
  const path = new URL("../../../api_final_projects.csv", import.meta.url);
  if (!existsSync(path)) return;
  const table = csvTable(readFileSync(path, "utf8"));
  assert.equal(detectSubmissionUrlHeader(table.headers), "Submission Url");
  assert.equal(detectTrackHeader(table.headers), "M Hacks Main Track");
  assert.ok(table.records.length >= 2);
  assert.ok(table.records[0]?.["Submission Url"]?.includes("/submissions/"));
});
