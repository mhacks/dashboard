"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Pie,
  PieChart,
  Rectangle,
  Sector,
  XAxis,
  YAxis,
  type BarShapeProps,
  type PieSectorShapeProps,
} from "recharts";
import {
  BarChart3Icon,
  MapPinnedIcon,
  TrophyIcon,
  UsersRoundIcon,
} from "lucide-react";
import type {
  AnalyticsBucket,
  ApplicationAnalyticsData,
} from "@/lib/types/application-reviews";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ApplicationReviewHeader } from "../components/application-review-header";
import { Meter } from "../components/meter";
import { SummaryBar } from "../components/summary-bar";

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

function resolveBucketFill(payload: unknown, fallback?: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "fill" in payload &&
    typeof payload.fill === "string"
  ) {
    return payload.fill;
  }

  return fallback;
}

function ColoredPieSector(props: PieSectorShapeProps) {
  return (
    <Sector {...props} fill={resolveBucketFill(props.payload, props.fill)} />
  );
}

function ColoredBar(props: BarShapeProps) {
  return (
    <Rectangle {...props} fill={resolveBucketFill(props.payload, props.fill)} />
  );
}

function EmptyState() {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
      No data yet.
    </div>
  );
}

function BucketList({ data }: { data: AnalyticsBucket[] }) {
  return (
    <div className="divide-y divide-border/60">
      {data.map((item, index) => (
        <div
          key={item.label}
          className="flex items-center justify-between gap-3 py-2.5 text-sm"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{
                backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
              }}
            />
            <span className="truncate">{item.label}</span>
          </div>
          <div className="shrink-0 text-right text-muted-foreground">
            <div>{item.count}</div>
            <div className="text-xs">{item.percentage}%</div>
          </div>
        </div>
      ))}
    </div>
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
  const pieSlices = chartData.filter((item) => item.count > 0);
  const pieData =
    pieSlices.length === 1
      ? [
          pieSlices[0],
          {
            label: "Remainder",
            count: 0.0001,
            percentage: 0,
            fill: "transparent",
          },
        ]
      : pieSlices;
  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 || total === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(200px,1fr)_220px]">
            <ChartContainer
              config={countConfig}
              initialDimension={{ width: 280, height: 280 }}
              className="mx-auto aspect-square h-[280px] w-full max-w-[280px]"
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
                  shape={ColoredPieSector}
                />
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
  const chartHeight = horizontal
    ? Math.max(260, chartData.length * 36 + 48)
    : 260;

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
            className="w-full"
            style={{ height: chartHeight }}
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
              <Bar
                dataKey="count"
                radius={horizontal ? 4 : [4, 4, 0, 0]}
                shape={ColoredBar}
              >
                <LabelList
                  dataKey="count"
                  position={horizontal ? "right" : "top"}
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
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
      <CardContent className="px-0 pb-0">
        {data.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState />
          </div>
        ) : (
          <ScrollArea className="max-h-[360px]">
            <div className="divide-y divide-border/60">
              {data.map((item, index) => (
                <div key={item.label} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 shrink-0 text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="truncate font-medium">{item.label}</span>
                    </div>
                    <span className="shrink-0 text-muted-foreground">
                      {item.count} · {item.percentage}%
                    </span>
                  </div>
                  <Meter value={item.percentage} className="mt-2 h-1" />
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBreakdownCard({
  data,
  totalApplicants,
}: {
  data: AnalyticsBucket[];
  totalApplicants: number;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Review Pipeline</CardTitle>
        <CardDescription>
          How {totalApplicants} submitted applications are distributed across
          review states.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          data.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">
                  {item.count} · {item.percentage}%
                </span>
              </div>
              <Meter value={item.percentage} className="mt-2 h-2" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ReviewProgressCard({ data }: { data: ApplicationAnalyticsData }) {
  const completionRate =
    data.totals.applicants === 0
      ? 0
      : Math.round(
          (data.scores.reviewedApplications / data.totals.applicants) * 1000,
        ) / 10;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Scorecard Completion</CardTitle>
        <CardDescription>
          Applications with both effort and builder ratings submitted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-3">
          <p className="font-heading text-4xl italic text-moss dark:text-sage">
            {data.scores.reviewedApplications}
          </p>
          <p className="pb-1 text-sm text-muted-foreground">
            of {data.totals.applicants} applicants
          </p>
        </div>
        <Meter value={completionRate} className="mt-4 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {completionRate}% completion rate across all applications.
        </p>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ data }: { data: ApplicationAnalyticsData }) {
  const topCountries = data.locations.countries.slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-5 xl:grid-cols-2">
        <PiePanel
          title="Application Status"
          description="Current review status of submitted applications."
          data={data.statusBreakdown}
        />
        <StatusBreakdownCard
          data={data.statusBreakdown}
          totalApplicants={data.totals.applicants}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <PiePanel
          title="Gender Snapshot"
          description="Self-reported gender distribution across applicants."
          data={data.demographics.gender}
        />
        <BarPanel
          title="Age Snapshot"
          description="Applicant ages grouped into review-friendly buckets."
          data={data.demographics.ageBuckets}
        />
        <RankedList
          title="Top Countries"
          description="Most represented countries on applications."
          data={topCountries}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ReviewProgressCard data={data} />
        <BarPanel
          title="Hackathon Experience"
          description="Prior hackathon participation across applicants."
          data={data.academics.previousHackathonBuckets}
        />
      </section>
    </div>
  );
}

function ReviewsTab({ data }: { data: ApplicationAnalyticsData }) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <BarPanel
        title="Effort / Motivation Ratings"
        description={`1-5 rating distribution across ${data.scores.reviewedApplications} completed scorecards.`}
        data={data.scores.effortRatings}
      />
      <BarPanel
        title="Builder Mindset Ratings"
        description={`1-5 rating distribution across ${data.scores.reviewedApplications} completed scorecards.`}
        data={data.scores.builderRatings}
      />
    </section>
  );
}

function DemographicsTab({ data }: { data: ApplicationAnalyticsData }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-5 xl:grid-cols-2">
        <PiePanel
          title="Gender Ratio"
          description="Self-reported gender distribution across applicants."
          data={data.demographics.gender}
        />
        <BarPanel
          title="Age Distribution"
          description="Applicant ages grouped into review-friendly buckets."
          data={data.demographics.ageBuckets}
        />
      </section>
      <BarPanel
        title="Ethnicity"
        description="Self-reported applicant ethnicity distribution."
        data={data.demographics.ethnicity}
        horizontal
      />
      <BarPanel
        title="Degree Mix"
        description="Academic level reported by applicants."
        data={data.demographics.degree}
        horizontal
      />
    </div>
  );
}

function AcademicsTab({ data }: { data: ApplicationAnalyticsData }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-5 xl:grid-cols-2">
        <BarPanel
          title="Previous Hackathons"
          description="Experience level from the application form."
          data={data.academics.previousHackathonBuckets}
        />
        <BarPanel
          title="Graduation Year"
          description="Applicant graduation year distribution in chronological order."
          data={data.demographics.graduationYear}
          horizontal
        />
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
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
      </section>
    </div>
  );
}

function LocationsTab({ data }: { data: ApplicationAnalyticsData }) {
  return (
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
    </section>
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
        <ApplicationReviewHeader
          title="Application Analytics"
          description="Overall applicant demographics, location signals, academic mix, and review score distributions."
        />

        <SummaryBar
          items={[
            {
              label: "Applicants",
              value: data.totals.applicants,
              hint: `${data.totals.pending} pending, ${data.totals.reviewed} reviewed, ${data.totals.flagged} flagged.`,
              icon: <UsersRoundIcon className="size-5" />,
            },
            {
              label: "Average age",
              value: data.totals.averageAge ?? "N/A",
              hint:
                data.totals.youngestAge === null
                  ? "No applicant age data yet."
                  : `Range ${data.totals.youngestAge}-${data.totals.oldestAge}.`,
              icon: <BarChart3Icon className="size-5" />,
            },
            {
              label: "Completed scorecards",
              value: data.scores.reviewedApplications,
              hint: "Applications with both effort and builder ratings.",
              icon: <TrophyIcon className="size-5" />,
            },
            {
              label: "Countries",
              value: data.locations.countries.length,
              hint: "Distinct countries represented in applications.",
              icon: <MapPinnedIcon className="size-5" />,
            },
          ]}
        />

        <Tabs defaultValue="overview">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
            <TabsTrigger value="academics">Academics</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5">
            <OverviewTab data={data} />
          </TabsContent>
          <TabsContent value="reviews" className="mt-5">
            <ReviewsTab data={data} />
          </TabsContent>
          <TabsContent value="demographics" className="mt-5">
            <DemographicsTab data={data} />
          </TabsContent>
          <TabsContent value="academics" className="mt-5">
            <AcademicsTab data={data} />
          </TabsContent>
          <TabsContent value="locations" className="mt-5">
            <LocationsTab data={data} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
