"use client";

import { CheckIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { searchAttendeesAction } from "@/lib/actions/check-in.server.actions";
import type { AttendeeMatch } from "@/lib/actions/check-in.actions";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

/**
 * The way in when the camera isn't the answer: a dead camera, a denied
 * permission, or — just as often — a hacker who left their phone upstairs.
 *
 * Always visible rather than revealed by a failure, because the second case is
 * the common one and hunting for a hidden fallback in a queue is its own delay.
 */
export function ManualEntry({
  slug,
  onPick,
  disabled,
}: {
  slug: string;
  /** Runs the same check-in path a scan does, tagged as manual. */
  onPick: (userId: string) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  // Results are stored with the term that produced them, so what is on screen
  // is derived rather than cleared. Stale matches from a previous term can
  // never flash while a new one is still being debounced.
  const [result, setResult] = useState<{
    term: string;
    matches: AttendeeMatch[];
  } | null>(null);
  const [isSearching, startSearching] = useTransition();

  // Guards against a slow early request landing after a fast later one and
  // overwriting the newer results.
  const requestRef = useRef(0);

  const term = query.trim();
  const isSearchable = term.length >= MIN_QUERY_LENGTH;
  const matches = result?.term === term ? result.matches : [];
  const searched = result?.term === term;

  useEffect(() => {
    if (!isSearchable) return;

    const timer = setTimeout(() => {
      const request = ++requestRef.current;
      startSearching(async () => {
        const found = await searchAttendeesAction({ slug, query: term });
        if (request !== requestRef.current) return;
        setResult({ term, matches: found });
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, isSearchable, slug]);

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-red-hat-mono text-[11px] tracking-[0.18em] text-ui-ink-soft uppercase">
        Find by name or email
      </h2>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ui-ink-soft" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jordan, or jordan@umich.edu"
          className="pl-9"
          autoComplete="off"
          // A phone keyboard that autocapitalises fights an email lookup.
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
        />
      </div>

      {searched && !isSearching && matches.length === 0 ? (
        <p className="px-1 text-[12px] text-ui-ink-soft">
          Nobody matches. Only accepted hackers who RSVPed can be checked in.
        </p>
      ) : null}

      {matches.length > 0 ? (
        <ul className="flex flex-col border border-ui-line">
          {matches.map((match) => (
            <li
              key={match.userId}
              className="border-b border-ui-line last:border-b-0"
            >
              <button
                type="button"
                disabled={disabled || match.checkedIn}
                onClick={() => onPick(match.userId)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-ui-selected disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ui-ink">
                    {match.name}
                  </span>
                  <span className="block truncate font-red-hat-mono text-[11px] text-ui-ink-soft">
                    {match.email}
                    {match.university ? ` · ${match.university}` : ""}
                  </span>
                </span>

                {match.checkedIn ? (
                  <span className="flex shrink-0 items-center gap-1 font-red-hat-mono text-[10.5px] tracking-[0.1em] text-ui-ink-soft uppercase">
                    <CheckIcon className="size-3.5" />
                    In
                  </span>
                ) : (
                  // A span, not a Button: the whole row is already the button,
                  // and nesting one inside another is invalid HTML.
                  <span className="shrink-0 rounded-[2px] border border-ui-line-strong px-2.5 py-1 font-red-hat-mono text-[10.5px] tracking-[0.1em] text-ui-ink uppercase">
                    Check in
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
