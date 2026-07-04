# Writing docs

Conventions for docs in this repo.

## Purpose

Docs should give a reader enough detail to understand how things work and what to
do. They should not accumulate warnings, summaries, and edge cases that duplicate
content or pad context for agents and humans alike.

## Rules

### Say it once

Each fact belongs in one doc. If a workflow is documented in
[local development](./local-development.md) or
[remote development](./remote-development.md), do not restate it in the README,
[development workflow](./development.md), or a **Gotchas** section.

Prefer linking over repeating. When two docs would say the same thing, keep the
detail in the doc that owns the topic and link to it elsewhere.

### No fluff

Do not include:

- **Gotchas sections** that repeat rules already stated in the same doc or in
  [development workflow](./development.md).
- **Obvious or one-off setup errors** — things a developer can diagnose from the
  command output (missing Docker, wrong port, typo in an env var).
- **Dramatic warnings** ("most-forgotten step", "easy to miss") when the workflow
  section already describes the step.
- **Sanity checks for rare edge cases** (e.g. one-time baselines) unless they are
  part of the normal path.
- **Closing summaries** that only recap what the page already said.

### Cross-doc links

When linking to another doc, use the link alone — no em-dash summary of what that
doc contains.

```markdown
<!-- good -->
- [Remote development](./remote-development.md)

<!-- bad -->
- [Remote development](./remote-development.md) — after merge to `main`, apply
  migrations and push auth config
```

The linked doc is the source of truth for its content.

### Cross-references to code

Pointing at a file or symbol in the repo is fine when the reader needs to know
where something lives. Keep it to path and, if non-obvious, one short clause —
not a tour of what the file does.

```markdown
<!-- good -->
Schema lives in [`lib/db/schema.ts`](../lib/db/schema.ts).

<!-- bad -->
See [`lib/db/schema.ts`](../lib/db/schema.ts), which defines all tables and
columns using Drizzle, exports typed relations, and is the single source of
truth for...
```

### Detail level

Stay procedural and factual:

- **Include** rules, commands, ownership, and conventions someone needs to work in
  the repo.
- **Include** tables and command references where they reduce lookup time.
- **Omit** narrative padding, repeated examples, and "putting it together"
  sections that restate earlier headings.

If a section exists only to index other docs, list links — do not preview them.
