import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { csvTable } from "./csv.ts";
import { readProjectView, readTrack } from "./display.ts";
import { enrichDevpostCsv } from "./enrich.ts";
import { normalizeDevpostUrl, resolveDevpostRedirect } from "./urls.ts";

test("normalizeDevpostUrl ignores case, www, query, and trailing slash", () => {
  assert.equal(
    normalizeDevpostUrl(
      "HTTPS://WWW.Devpost.com/software/MBathrooms/?ref=gallery",
    ),
    "https://devpost.com/software/mbathrooms",
  );
  assert.equal(normalizeDevpostUrl("https://example.com/software/x"), null);
});

test("resolveDevpostRedirect follows a submission URL to the public project", async () => {
  const resolved = await resolveDevpostRedirect(
    "https://mhacks-2025.devpost.com/submissions/807450-mbathroom",
    async (input, init) => {
      const url = String(input);
      assert.equal(init?.redirect, "manual");
      assert.equal(init?.method, "HEAD");
      if (url.includes("/submissions/")) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://devpost.com/software/mbathrooms" },
        });
      }
      return new Response(null, { status: 200 });
    },
  );
  assert.equal(resolved, "https://devpost.com/software/mbathrooms");
});

test("enrichDevpostCsv joins on the redirected URL and keeps unknown columns", async () => {
  const csv = [
    "Project Title,Submission Url,M Hacks Main Track,Custom Sponsor Field",
    "MBathroom,https://mhacks-2025.devpost.com/submissions/1,Lifeline,widgets",
    "Concord,https://mhacks-2025.devpost.com/submissions/2,Overdrive,mail",
    "Surgent,https://devpost.com/software/surgent/,Lifeline,lenses",
  ].join("\n");

  const { csv: enriched, summary } = await enrichDevpostCsv(
    csv,
    [
      {
        devpostUrl: "https://devpost.com/software/mbathrooms",
        teamId: "team-1",
        teamName: "Flush Finders",
        tableNumber: 12,
      },
      {
        devpostUrl: "https://www.devpost.com/software/Surgent",
        teamId: "team-3",
        teamName: "Surgent",
        tableNumber: null,
      },
    ],
    async (url) => {
      if (url.endsWith("/submissions/1")) {
        return "https://devpost.com/software/mbathrooms";
      }
      if (url.endsWith("/submissions/2")) {
        return "https://devpost.com/software/concord";
      }
      return url;
    },
  );

  assert.equal(summary.matched, 2);
  assert.equal(summary.unmatched, 1);
  assert.equal(summary.trackHeader, "M Hacks Main Track");
  assert.equal(summary.submissionUrlHeader, "Submission Url");
  assert.match(enriched, /Custom Sponsor Field/);
  assert.match(enriched, /Flush Finders/);
  assert.match(enriched, /dashboard_table_number/);

  const table = csvTable(enriched);
  const bathroom = table.records[0];
  assert.equal(bathroom?.dashboard_team_name, "Flush Finders");
  assert.equal(bathroom?.dashboard_table_number, "12");
  assert.equal(bathroom?.dashboard_track, "Lifeline");
  assert.equal(
    bathroom?.resolved_submission_url,
    "https://devpost.com/software/mbathrooms",
  );
  assert.equal(table.records[1]?.dashboard_team_id, "");
  assert.equal(table.records[2]?.dashboard_team_name, "Surgent");
  assert.equal(table.records[2]?.dashboard_table_number, "");

  const view = readProjectView({
    id: 0,
    attributes: bathroom ?? {},
  });
  assert.equal(view.title, "MBathroom");
  assert.equal(view.track, "Lifeline");
  assert.equal(view.tableNumeric, 12);
  assert.equal(view.teamName, "Flush Finders");
  assert.equal(readTrack({ "M Hacks Main Track": "Overdrive" }), "Overdrive");
});

test("the sample Devpost export keeps blank team-member columns and still joins", async () => {
  const path = new URL("../../../api_final_projects.csv", import.meta.url);
  if (!existsSync(path)) return;
  const { csv, summary } = await enrichDevpostCsv(
    readFileSync(path, "utf8"),
    [
      {
        devpostUrl: "https://devpost.com/software/mbathrooms",
        teamId: "team-1",
        teamName: "Flush Finders",
        tableNumber: 4,
      },
    ],
    async (url) =>
      url.includes("/submissions/807450-")
        ? "https://devpost.com/software/mbathrooms"
        : url,
  );
  assert.ok(summary.projects >= 2);
  assert.equal(summary.matched, 1);
  assert.equal(summary.trackHeader, "M Hacks Main Track");
  assert.ok(summary.renamedHeaders.length >= 5);
  const table = csvTable(csv);
  assert.equal(
    table.headers.filter((header) => header.trim() === "").length,
    0,
  );
  assert.equal(table.records[0]?.dashboard_team_name, "Flush Finders");
  assert.equal(table.records[0]?.dashboard_table_number, "4");
  assert.equal(table.records[0]?.dashboard_track, "Lifeline");
  const view = readProjectView({
    id: 0,
    attributes: table.records[0] ?? {},
  });
  assert.equal(
    view.details.some((field) => field.value.includes("@")),
    false,
  );
});

test("enrichDevpostCsv names the headers when no submission URL column exists", async () => {
  await assert.rejects(
    () =>
      enrichDevpostCsv("Name,Track\nA,One\nB,Two\n", [], async (url) => url),
    /No submission URL column/,
  );
});
