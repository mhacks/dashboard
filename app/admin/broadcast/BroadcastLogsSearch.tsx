"use client";

import { Loader2, SearchIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildBroadcastLogsQuery } from "@/lib/broadcast/log-filter";

const SEARCH_DEBOUNCE_MS = 400;

type BroadcastLogsSearchProps = {
  initialQuery: string;
  channelLabel: string;
};

export function BroadcastLogsSearch({
  initialQuery,
  channelLabel,
}: BroadcastLogsSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const queryRef = useRef(initialQuery);
  const committedQueryRef = useRef(initialQuery);
  const pendingSearchRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const isFocusedRef = useRef(false);

  const isLoading = isDebouncing || isSearching;

  useEffect(() => {
    committedQueryRef.current = initialQuery;

    if (
      pendingSearchRef.current !== null &&
      initialQuery.trim() === pendingSearchRef.current
    ) {
      pendingSearchRef.current = null;
      setIsSearching(false);
    }

    if (!isFocusedRef.current) {
      queryRef.current = initialQuery;
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function navigateToQuery(nextQuery: string) {
    const trimmed = nextQuery.trim();

    if (trimmed === committedQueryRef.current.trim()) {
      pendingSearchRef.current = null;
      setIsSearching(false);
      return;
    }

    pendingSearchRef.current = trimmed;
    setIsSearching(true);
    router.push(`${pathname}${buildBroadcastLogsQuery(trimmed || undefined)}`);
  }

  function scheduleNavigation(nextQuery: string) {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    const trimmed = nextQuery.trim();
    if (trimmed === committedQueryRef.current.trim()) {
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      setIsDebouncing(false);
      navigateToQuery(nextQuery);
    }, SEARCH_DEBOUNCE_MS);
  }

  function flushNavigation() {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
      setIsDebouncing(false);
    }

    navigateToQuery(queryRef.current);
  }

  function handleChange(value: string) {
    queryRef.current = value;
    setQuery(value);
    scheduleNavigation(value);
  }

  const scopeLabel = `#${channelLabel}`;

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 px-1">
      <p className="text-[11px] text-muted-foreground">
        Search within{" "}
        <span className="font-medium text-foreground">{scopeLabel}</span>
      </p>

      <div className="relative w-full">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
            flushNavigation();
          }}
          placeholder={`Search subject, body, or sender in ${scopeLabel}`}
          aria-label={`Search broadcasts in ${scopeLabel}`}
          aria-busy={isLoading}
          className={cn(
            "h-8 w-full pl-9 text-sm",
            isLoading ? "pr-9" : undefined,
          )}
        />
        {isLoading ? (
          <Loader2
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        ) : null}
      </div>
    </div>
  );
}
