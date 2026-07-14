"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeftIcon,
  BarChart3Icon,
  MapPinnedIcon,
  TrophyIcon,
  UsersRoundIcon,
} from "lucide-react";
import type {
  AnalyticsBucket,
  ApplicationAnalyticsData,
} from "@/lib/types/application-reviews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import ThemeToggle from "../theme-toggle";
const CHART_COLORS = [
  "var(--color-moss)",
  "var(--color-sage)",
  "#7c8f55",
  "#b7c58c",
  "#d6b36a",
  "#8f7b4f",
  "#9aa7bd",
  "#c58c8c",
];

const countConfig = {
  count: {
    label: "Applicants",
    color: "var(--color-moss)",
  },
} satisfies ChartConfig;

function withFills(items: AnalyticsBucket[]) {
  return items.map((item, index) => ({
    ...item,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));
}

function formatScore(value: number | null) {
  return value === null ? "N/A" : value.toFixed(1);
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardDescription className="font-red-hat text-xs font-semibold uppercase tracking-wide">
            {label}
          </CardDescription>
          <div className="text-moss dark:text-sage">{icon}</div>
        </div>
        <CardTitle className="font-heading text-3xl italic text-moss dark:text-sage">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-full bg-moss/10 dark:bg-sage/10",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-moss transition-all dark:bg-sage"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function ScoreCard({
  label,
  value,
  reviewedApplications,
}: {
  label: string;
  value: number | null;
  reviewedApplications: number;
}) {
  const percent = value === null ? 0 : (value / 5) * 100;

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="font-red-hat text-xs font-semibold uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="font-heading text-3xl italic text-moss dark:text-sage">
          {formatScore(value)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Meter value={percent} className="h-2" />
        <p className="text-xs text-muted-foreground">
          Average out of 5 across {reviewedApplications} completed scorecards.
        </p>
      </CardContent>
    </Card>
  );
}

function PiePanel({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: AnalyticsBucket[];
}) {
  const chartData = withFills(data);
  const pieData =
    chartData.length === 1
      ? [
          chartData[0],
          {
            label: "Remainder",
            count: 0.0001,
            percentage: 0,
            fill: "transparent",
          },
        ]
      : chartData;
  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <ChartContainer
              config={countConfig}
              className="mx-auto aspect-square max-h-[280px]"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel nameKey="label" />}
                />
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={92}
                  paddingAngle={pieData.length > 1 ? 2 : 0}
                  stroke="var(--color-card)"
                  strokeWidth={3}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Pie>
                <text
                  x="50%"
                  y="47%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-2xl font-semibold"
                >
                  {total}
                </text>
                <text
                  x="50%"
                  y="58%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-xs"
                >
                  Applicants
                </text>
              </PieChart>
            </ChartContainer>
            <BucketList data={chartData} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BarPanel({
  title,
  description,
  data,
  horizontal = false,
}: {
  title: string;
  description: string;
  data: AnalyticsBucket[];
  horizontal?: boolean;
}) {
  const chartData = withFills(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartContainer
            config={countConfig}
            className={cn("h-[260px] w-full", horizontal && "h-[320px]")}
          >
            <BarChart
              data={chartData}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={{
                left: horizontal ? 24 : 8,
                right: 12,
                top: 12,
                bottom: 8,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              {horizontal ? (
                <>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={110}
                    tickLine={false}
                    axisLine={false}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                </>
              )}
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="count" radius={horizontal ? 4 : [4, 4, 0, 0]}>
                <LabelList
                  dataKey="count"
                  position={horizontal ? "right" : "top"}
                  className="fill-foreground"
                  fontSize={12}
                />
                {chartData.map((entry) => (
                  <Cell key={entry.label} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function BucketList({ data }: { data: AnalyticsBucket[] }) {
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={item.label} className="rounded-lg border bg-muted/20 p-2.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span className="truncate font-medium">{item.label}</span>
            </div>
            <span className="shrink-0 text-muted-foreground">{item.count}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {item.percentage}% of applicants
          </div>
        </div>
      ))}
    </div>
  );
}

function RankedList({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: AnalyticsBucket[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {data.map((item, index) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className="w-8 justify-center">
                      {index + 1}
                    </Badge>
                    <span className="truncate font-medium">{item.label}</span>
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {item.count} · {item.percentage}%
                  </span>
                </div>
                <Meter value={item.percentage} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
      No data yet.
    </div>
  );
}

export default function ApplicationAnalyticsDashboard({
  data,
}: {
  data: ApplicationAnalyticsData;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-red-hat text-xs font-semibold uppercase tracking-[0.22em] text-moss/55 dark:text-sage/60">
              MHacks Organizer
            </p>
            <h1 className="font-heading text-4xl italic tracking-tight text-moss dark:text-sage">
              Application Analytics
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Overall applicant demographics, location signals, academic mix,
              and average review scores.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/applications">
                <ArrowLeftIcon className="size-4" />
                Back to reviews
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/applications/leaderboard">
                <TrophyIcon className="size-4" />
                Leaderboard
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Applicants"
            value={data.totals.applicants}
            hint={`${data.totals.pending} pending, ${data.totals.reviewed} reviewed, ${data.totals.flagged} flagged.`}
            icon={<UsersRoundIcon className="size-5" />}
          />
          <StatCard
            label="Average age"
            value={data.totals.averageAge ?? "N/A"}
            hint={
              data.totals.youngestAge === null
                ? "No applicant age data yet."
                : `Range ${data.totals.youngestAge}-${data.totals.oldestAge}.`
            }
            icon={<BarChart3Icon className="size-5" />}
          />
          <StatCard
            label="Overall score"
            value={formatScore(data.scores.overallAverage)}
            hint={`Across ${data.scores.reviewedApplications} completed scorecards.`}
            icon={<TrophyIcon className="size-5" />}
          />
          <StatCard
            label="Countries"
            value={data.locations.countries.length}
            hint="Distinct countries represented in applications."
            icon={<MapPinnedIcon className="size-5" />}
          />
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <ScoreCard
            label="Effort / Motivation"
            value={data.scores.effortAverage}
            reviewedApplications={data.scores.reviewedApplications}
          />
          <ScoreCard
            label="Builder Mindset"
            value={data.scores.builderAverage}
            reviewedApplications={data.scores.reviewedApplications}
          />
          <ScoreCard
            label="Overall"
            value={data.scores.overallAverage}
            reviewedApplications={data.scores.reviewedApplications}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <PiePanel
            title="Gender Ratio"
            description="Self-reported gender distribution across applicants."
            data={data.demographics.gender}
          />
          <PiePanel
            title="Application Status"
            description="Current review status of submitted applications."
            data={[
              {
                label: "Pending",
                count: data.totals.pending,
                percentage:
                  data.totals.applicants === 0
                    ? 0
                    : Math.round(
                        (data.totals.pending / data.totals.applicants) * 1000,
                      ) / 10,
              },
              {
                label: "Reviewed",
                count: data.totals.reviewed,
                percentage:
                  data.totals.applicants === 0
                    ? 0
                    : Math.round(
                        (data.totals.reviewed / data.totals.applicants) * 1000,
                      ) / 10,
              },
              {
                label: "Flagged",
                count: data.totals.flagged,
                percentage:
                  data.totals.applicants === 0
                    ? 0
                    : Math.round(
                        (data.totals.flagged / data.totals.applicants) * 1000,
                      ) / 10,
              },
            ]}
          />
          <BarPanel
            title="Age Distribution"
            description="Applicant ages grouped into review-friendly buckets."
            data={data.demographics.ageBuckets}
          />
          <BarPanel
            title="Degree Mix"
            description="Academic level reported by applicants."
            data={data.demographics.degree}
          />
          <BarPanel
            title="Previous Hackathons"
            description="Experience level from the application form."
            data={data.academics.previousHackathonBuckets}
          />
          <BarPanel
            title="Graduation Year"
            description="Applicant graduation year distribution."
            data={data.demographics.graduationYear}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          <RankedList
            title="Top Countries"
            description="Country selected on the application."
            data={data.locations.countries}
          />
          <RankedList
            title="Top US States"
            description="Parsed from “coming from” when a state code is present."
            data={data.locations.usStates}
          />
          <RankedList
            title="Coming From"
            description="Most common free-text origin responses."
            data={data.locations.comingFrom}
          />
          <RankedList
            title="Universities"
            description="Most represented schools."
            data={data.academics.universities}
          />
          <RankedList
            title="Majors"
            description="Most common academic interests."
            data={data.demographics.major}
          />
          <RankedList
            title="Ethnicity"
            description="Self-reported applicant ethnicity distribution."
            data={data.demographics.ethnicity}
          />
        </section>
      </div>
    </main>
  );
}
