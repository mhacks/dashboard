"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { DownloadIcon, FileTextIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { ListPagination } from "@/app/admin/applications/components/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminRsvpReceiptDownloadUrl } from "@/lib/actions/admin-rsvps.server.actions";
import { formatCents } from "@/lib/currency";
import { clampPageIndex, getPageCount, paginateSlice } from "@/lib/pagination";
import type {
  AdminRsvpDashboard,
  AdminRsvpSummary,
} from "@/lib/types/admin-rsvps";
import type { RsvpStatus } from "@/lib/rsvp/status";

const PAGE_SIZE = 25;

type StatusFilter = "all" | RsvpStatus;
type TravelFilter = "all" | "local" | "self-funded" | "reimbursement";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
};

const TRAVEL_LABELS: Record<Exclude<TravelFilter, "all">, string> = {
  local: "Local",
  "self-funded": "Self-funded",
  reimbursement: "Reimbursement",
};

function statusBadge(status: RsvpStatus) {
  if (status === "submitted") return <Badge>Submitted</Badge>;
  if (status === "in_progress") {
    return <Badge variant="secondary">In progress</Badge>;
  }
  return <Badge variant="outline">Not started</Badge>;
}

function ReceiptCell({ row }: { row: AdminRsvpSummary }) {
  const [isPending, startTransition] = useTransition();

  if (!row.receipt) return <span className="text-muted-foreground">—</span>;
  const { originalName } = row.receipt;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      className="max-w-56 justify-start px-2"
      title={originalName}
      onClick={() =>
        startTransition(async () => {
          const url = await getAdminRsvpReceiptDownloadUrl(row.applicationSlug);
          if (!url) {
            toast.error(
              `Could not open the receipt for ${row.applicationName}.`,
            );
            return;
          }
          window.location.assign(url);
        })
      }
    >
      <FileTextIcon data-icon="inline-start" />
      <span className="truncate">{originalName}</span>
    </Button>
  );
}

function searchableText(row: AdminRsvpSummary): string {
  return [row.applicationName, row.accountEmail]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function RsvpResponses({
  dashboard,
}: {
  dashboard: AdminRsvpDashboard;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [travel, setTravel] = useState<TravelFilter>("all");
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dashboard.rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (travel !== "all" && row.travelPlan !== travel) return false;
      return !query || searchableText(row).includes(query);
    });
  }, [dashboard.rows, search, status, travel]);

  const safePageIndex = clampPageIndex(
    pageIndex,
    getPageCount(filteredRows.length, PAGE_SIZE),
  );
  const visibleRows = paginateSlice(filteredRows, safePageIndex, PAGE_SIZE);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={status}
              onValueChange={(value) => {
                setStatus(value as StatusFilter);
                setPageIndex(0);
              }}
            >
              <TabsList className="h-auto flex-wrap">
                {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((value) => (
                  <TabsTrigger key={value} value={value}>
                    {STATUS_LABELS[value]} ({dashboard.counts[value]})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button asChild>
              <Link href="/admin/rsvps/export" prefetch={false}>
                <DownloadIcon data-icon="inline-start" />
                Export CSV
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPageIndex(0);
                }}
                placeholder="Search names or emails"
                aria-label="Search RSVP responses"
                className="pl-9"
              />
            </div>
            <Select
              value={travel}
              onValueChange={(value) => {
                setTravel(value as TravelFilter);
                setPageIndex(0);
              }}
            >
              <SelectTrigger aria-label="Filter by travel plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All travel plans</SelectItem>
                  {Object.entries(TRAVEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Travel</TableHead>
              <TableHead>Reimbursement region</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>T-shirt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-28 text-center text-muted-foreground"
                >
                  No RSVP responses match these filters.
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow key={row.applicationId}>
                  <TableCell>
                    <Link
                      href={`/admin/rsvps/${row.applicationSlug}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {row.applicationName}
                    </Link>
                  </TableCell>
                  <TableCell>{row.accountEmail}</TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                  <TableCell>
                    {row.submittedAt
                      ? new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(row.submittedAt))
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {row.travelPlan ? TRAVEL_LABELS[row.travelPlan] : "—"}
                  </TableCell>
                  <TableCell>
                    {row.award
                      ? `${row.award.regionLabel} · ${formatCents(row.award.amountCents)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <ReceiptCell row={row} />
                  </TableCell>
                  <TableCell>{row.tshirtSize ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <ListPagination
          pageIndex={safePageIndex}
          totalItems={filteredRows.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPageIndex}
        />
      </CardContent>
    </Card>
  );
}
