"use client";

import { SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  countActiveReviewFilters,
  DEFAULT_REVIEW_FILTERS,
  REVIEW_FILTERS,
  selectedFilterValue,
  type ReviewFilterState,
} from "./review-filters";

export function ReviewFiltersPopover({
  value,
  onChange,
}: {
  value: ReviewFilterState;
  onChange: (filters: ReviewFilterState) => void;
}) {
  const activeCount = countActiveReviewFilters(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative shrink-0"
          aria-label={
            activeCount > 0 ? `Filters (${activeCount} active)` : "Filters"
          }
        >
          <SlidersHorizontalIcon className="size-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] leading-none font-semibold text-primary-foreground tabular-nums">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <PopoverHeader className="flex-row items-center justify-between">
          <PopoverTitle>Filters</PopoverTitle>
          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange(DEFAULT_REVIEW_FILTERS)}
            >
              Clear
            </Button>
          )}
        </PopoverHeader>
        {REVIEW_FILTERS.map((def) => {
          const inputId = `review-filter-${def.key}`;
          return (
            <div key={def.key} className="space-y-1.5">
              <Label
                htmlFor={inputId}
                className="text-xs text-muted-foreground"
              >
                {def.label}
              </Label>
              <Select
                value={selectedFilterValue(value, def.key)}
                onValueChange={(next) =>
                  onChange({ ...value, [def.key]: next })
                }
              >
                <SelectTrigger id={inputId} size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {def.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
