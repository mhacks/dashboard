"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, LoaderCircle, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type UniversitySearchResult = {
  name: string;
  country: string;
  alphaTwoCode: string;
  stateProvince: string | null;
  domains: string[];
  webPages: string[];
};

type SearchState = "idle" | "loading" | "ready" | "error";

const SEARCH_DELAY_MS = 180;

function formatLocation(university: UniversitySearchResult) {
  return [university.stateProvince, university.country]
    .filter(Boolean)
    .join(", ");
}

export function UniversitySearch({
  value,
  onChange,
  placeholder = "Search university",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<UniversitySearchResult[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputValue = value ?? "";
  const trimmedInput = inputValue.trim();
  const selectedResult = useMemo(
    () => results.find((result) => result.name === value),
    [results, value],
  );

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const query = trimmedInput;

    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchState("loading");
      try {
        const response = await fetch(
          `/api/universities?query=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );

        if (!response.ok) throw new Error("Unable to search universities");

        const payload = (await response.json()) as {
          results?: UniversitySearchResult[];
        };
        setResults(payload.results ?? []);
        setSearchState("ready");
        setActiveIndex(0);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        setResults([]);
        setSearchState("error");
      }
    }, SEARCH_DELAY_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [trimmedInput]);

  const selectUniversity = (university: UniversitySearchResult) => {
    onChange(university.name);
    setIsOpen(false);
  };

  const commitTypedValue = () => {
    onChange(trimmedInput);
    setIsOpen(false);
  };

  const hasTypedCustomValue =
    trimmedInput.length > 0 &&
    !results.some(
      (university) =>
        university.name.toLowerCase() === trimmedInput.toLowerCase(),
    );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={inputValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            setSearchState(nextValue.trim().length >= 2 ? "loading" : "idle");
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              if (results.length > 0) {
                setActiveIndex((index) =>
                  Math.min(index + 1, results.length - 1),
                );
              }
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (results.length > 0) {
                setActiveIndex((index) => Math.max(index - 1, 0));
              }
            }
            if (event.key === "Enter" && isOpen) {
              event.preventDefault();
              const result = results[activeIndex];
              if (result) selectUniversity(result);
              else commitTypedValue();
            }
            if (event.key === "Escape") setIsOpen(false);
          }}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          placeholder={placeholder}
          className="pr-9 pl-8"
        />
        {inputValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
            onClick={() => {
              onChange("");
              setSearchState("idle");
              setIsOpen(false);
            }}
            aria-label="Clear university"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>

      {selectedResult && (
        <p className="mt-1 font-red-hat text-[11px] text-muted-foreground">
          {formatLocation(selectedResult)}
          {selectedResult.domains[0] ? ` - ${selectedResult.domains[0]}` : ""}
        </p>
      )}

      {isOpen && trimmedInput.length >= 2 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {searchState === "loading" && (
            <div className="flex items-center gap-2 px-2 py-2 font-red-hat text-sm text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin" />
              Searching universities
            </div>
          )}

          {searchState === "error" && (
            <div className="px-2 py-2 font-red-hat text-sm text-muted-foreground">
              Search is unavailable. You can still type your school name.
            </div>
          )}

          {searchState === "ready" && results.length === 0 && (
            <div className="px-2 py-2 font-red-hat text-sm text-muted-foreground">
              No matching universities. Keep your typed school name.
            </div>
          )}

          {results.map((university, index) => (
            <button
              key={`${university.name}-${university.alphaTwoCode}-${university.domains[0] ?? index}`}
              type="button"
              role="option"
              aria-selected={university.name === value}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left font-red-hat text-sm outline-none transition-colors",
                index === activeIndex
                  ? "bg-muted text-foreground"
                  : "hover:bg-muted/70",
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectUniversity(university)}
            >
              <Check
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  university.name === value ? "opacity-100" : "opacity-0",
                )}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {university.name}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {formatLocation(university)}
                  {university.domains[0] ? ` - ${university.domains[0]}` : ""}
                </span>
              </span>
            </button>
          ))}

          {hasTypedCustomValue && (
            <button
              type="button"
              className="mt-1 w-full rounded-md border border-dashed border-border px-2 py-2 text-left font-red-hat text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              onClick={commitTypedValue}
            >
              Use &quot;{trimmedInput}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
