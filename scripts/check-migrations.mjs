// Guards the one failure drizzle's migrator cannot report: a migration that
// never runs.
//
// `drizzle-kit migrate` reads the newest `created_at` in __drizzle_migrations
// once, then applies only the journal entries whose `when` is greater. So a
// migration is skipped -- silently, permanently, exit code 0 -- whenever it
// lands on main carrying a `when` below one that main has already deployed.
// That is not about the order inside _journal.json, which stays sorted by
// filename and looks fine; it is about merge order. A branch cut a week ago
// generates an old `when`, another PR merges first with a newer one, and the
// older migration is dead on arrival.
//
// It has happened three times: #94 (fixed by #106), then #127, whose events
// tables never reached production and only surfaced when #131 built on them
// and the deploy failed with `relation "public.events" does not exist`.
//
// Run against the base branch, so it answers the question that matters: if this
// merged right now, would anything be skipped?

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const DIR = "supabase/migrations";
const JOURNAL = `${DIR}/meta/_journal.json`;
const BASE = process.env.BASE_REF ?? "origin/main";
const HEAD = process.env.HEAD_REF ?? null;

const problems = [];

const readJournal = (text) => JSON.parse(text).entries ?? [];
const atRef = (ref, path) =>
  execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" });

const entries = readJournal(
  HEAD ? atRef(HEAD, JOURNAL) : readFileSync(JOURNAL, "utf8"),
);

// 1. The journal and the folder have to agree. A .sql file with no entry runs
//    under `supabase db reset` locally and never in production; an entry with
//    no file makes drizzle throw mid-deploy.
const tags = new Set(entries.map((e) => e.tag));
const files = new Set(
  (HEAD
    ? execFileSync("git", ["ls-tree", "--name-only", HEAD, `${DIR}/`], {
        encoding: "utf8",
      })
        .split("\n")
        .filter((f) => f.endsWith(".sql"))
        .map((f) => f.slice(DIR.length + 1))
    : readdirSync(DIR).filter((f) => f.endsWith(".sql"))
  ).map((f) => f.replace(/\.sql$/, "")),
);
for (const tag of tags)
  if (!files.has(tag))
    problems.push(`${tag}: in the journal, but no .sql file`);
for (const file of files)
  if (!tags.has(file))
    problems.push(`${file}.sql: in the folder, but no journal entry`);

// 2. Two entries sharing a `when` are ambiguous to the high-water-mark test.
const seen = new Map();
for (const e of entries) {
  if (seen.has(e.when))
    problems.push(`${e.tag}: shares when=${e.when} with ${seen.get(e.when)}`);
  seen.set(e.when, e.tag);
}

// 3. The real check. Anything this branch adds must outrank every `when`
//    already on the base branch, or the base's databases will skip it.
let base = null;
try {
  base = readJournal(atRef(BASE, JOURNAL));
} catch {
  console.log(
    `migrations: ${BASE} unavailable, skipping the merge-order check`,
  );
}

if (base?.length) {
  const deployed = new Set(base.map((e) => e.tag));
  const highWaterMark = Math.max(...base.map((e) => e.when));
  const behind = base.find((e) => e.when === highWaterMark);

  for (const e of entries) {
    if (deployed.has(e.tag) || e.when > highWaterMark) continue;
    problems.push(
      `${e.tag}: when=${e.when} does not clear ${BASE}, whose newest is ` +
        `${highWaterMark} (${behind.tag}). Production would skip this ` +
        `migration without erroring. Rebase on ${BASE}, delete the migration ` +
        `and re-run \`pnpm db:generate\` so it gets a current timestamp.`,
    );
  }
}

if (problems.length) {
  console.error(`\nmigrations: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("");
  process.exit(1);
}

console.log(`migrations: ${entries.length} entries OK`);
