"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildBroadcastLogsQuery } from "@/lib/broadcast/log-filter";
import { RecipientSearchField } from "./RecipientSearchField";

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
  const pendingSearchRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const isFocusedRef = useRef(false);

  const isLoading = isDebouncing || isSearching;
  const committedQuery = initialQuery.trim();

  useEffect(() => {
    if (
      pendingSearchRef.current !== null &&
      committedQuery === pendingSearchRef.current
    ) {
      pendingSearchRef.current = null;
      setIsSearching(false);
    }

    if (!isFocusedRef.current) {
      setQuery(initialQuery);
    }
  }, [committedQuery, initialQuery]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function navigateToQuery(nextQuery: string) {
    const trimmed = nextQuery.trim();

    if (trimmed === committedQuery) {
      pendingSearchRef.current = null;
      setIsSearching(false);
      return;
    }

    pendingSearchRef.current = trimmed;
    setIsSearching(true);
    router.push(`${pathname}${buildBroadcastLogsQuery(trimmed)}`);
  }

  function scheduleNavigation(nextQuery: string) {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    if (nextQuery.trim() === committedQuery) {
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

    navigateToQuery(query);
  }

  const scopeLabel = `#${channelLabel}`;

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 px-1">
      <p className="text-[11px] text-muted-foreground">
        Search within{" "}
        <span className="font-medium text-foreground">{scopeLabel}</span>
      </p>

      <RecipientSearchField
        value={query}
        onChange={(value) => {
          setQuery(value);
          scheduleNavigation(value);
        }}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          flushNavigation();
        }}
        placeholder={`Search subject, body, or sender in ${scopeLabel}`}
        aria-label={`Search broadcasts in ${scopeLabel}`}
        isLoading={isLoading}
        className="w-full"
        inputClassName="pl-9 text-sm"
      />
    </div>
  );
}
