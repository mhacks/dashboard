"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Award,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Coins,
  ExternalLink,
  Lock,
  Map as MapIcon,
  MapPin,
  Megaphone,
  Search,
  Trophy,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  LIQUID_GLASS_CARD_CLASS,
  LIQUID_GLASS_PANEL_CLASS,
  LIQUID_GLASS_PILL_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

const EVENT_TIME_ZONE = "America/Detroit";

export type LiveEvent = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  description: string;
  eventType: string;
  mapUrl: string | null;
};

type Source = "database" | "empty" | "fallback";

type LiveEventsProps = {
  events: LiveEvent[];
  source: Source;
};

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: EVENT_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: EVENT_TIME_ZONE,
});

function dayKey(isoDate: string) {
  const date = new Date(isoDate);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatEventTime(event: LiveEvent) {
  const start = timeFormatter.format(new Date(event.startsAt));
  if (!event.endsAt) return start;
  return `${start} – ${timeFormatter.format(new Date(event.endsAt))}`;
}

function getEventStatus(event: LiveEvent) {
  const now = Date.now();
  const start = new Date(event.startsAt).getTime();
  const end = event.endsAt ? new Date(event.endsAt).getTime() : start;

  if (now >= start && now <= end) return "Live" as const;
  if (now < start) return "Upcoming" as const;
  return "Past" as const;
}

function groupEvents(events: LiveEvent[]) {
  return events.reduce<
    Array<{ key: string; label: string; events: LiveEvent[] }>
  >((days, event) => {
    const key = dayKey(event.startsAt);
    const existing = days.find((day) => day.key === key);

    if (existing) {
      existing.events.push(event);
      return days;
    }

    days.push({
      key,
      label: dayLabelFormatter.format(new Date(event.startsAt)),
      events: [event],
    });

    return days;
  }, []);
}

function SourceNote({ source }: { source: Source }) {
  if (source === "database") return null;

  return (
    <p className="font-red-hat text-xs text-ink/45">
      {source === "empty"
        ? "Showing sample events until published events are added."
        : "Showing sample events while database events are unavailable."}
    </p>
  );
}

function StatusDot({ status }: { status: ReturnType<typeof getEventStatus> }) {
  if (status === "Live") {
    return (
      <span className="font-red-hat inline-flex items-center gap-1.5 rounded-full bg-[#c43a1c]/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#9c2e15]">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c43a1c] opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-[#c43a1c]" />
        </span>
        Live
      </span>
    );
  }

  if (status === "Past") {
    return (
      <span className="font-red-hat text-[11px] font-medium uppercase tracking-wider text-ink/35">
        Past
      </span>
    );
  }

  return null;
}

type PredictionStatus = "open" | "locked" | "resolved";
type PredictionOutcome = { id: string; label: string; pool: number };
type Prediction = {
  id: string;
  category: string;
  question: string;
  status: PredictionStatus;
  closesAt: string;
  outcomes: PredictionOutcome[];
  winningOutcomeId?: string;
};

const STARTING_BALANCE = 500;
const BET_PRESETS = [10, 50, 100, 250] as const;

const placeholderPredictions: Prediction[] = [
  {
    id: "pred-submissions",
    category: "Hackathon",
    question: "How many teams will submit before the deadline?",
    status: "open",
    closesAt: "2026-10-04T12:30:00-04:00",
    outcomes: [
      { id: "a", label: "Under 200", pool: 3_400 },
      { id: "b", label: "200 – 300", pool: 8_720 },
      { id: "c", label: "300 – 400", pool: 4_150 },
      { id: "d", label: "Over 400", pool: 1_200 },
    ],
  },
];

type UserBet = { outcomeId: string; amount: number };

function formatClosesIn(iso: string, now: number) {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "Closed";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `Closes in ${mins}m`;
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return `Closes in ${hours}h`;
  const days = Math.round(diff / 86_400_000);
  return `Closes in ${days}d`;
}

function LivePredictions({ items }: { items: Prediction[] }) {
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [bets, setBets] = useState<Record<string, UserBet>>({});
  const [pools, setPools] = useState<Record<string, Record<string, number>>>(
    () =>
      Object.fromEntries(
        items.map((p) => [
          p.id,
          Object.fromEntries(p.outcomes.map((o) => [o.id, o.pool])),
        ]),
      ),
  );
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (items.length === 0) return null;

  const active = items[0]!;
  const activePool = pools[active.id]!;
  const total = Object.values(activePool).reduce((a, b) => a + b, 0);
  const myBet = bets[active.id];
  const selected = selection[active.id] ?? null;
  const bet = amounts[active.id] ?? 50;

  const oddsFor = (outcomeId: string) => {
    const pool = activePool[outcomeId] ?? 0;
    if (pool === 0) return total > 0 ? total : 1;
    return total / pool;
  };

  const clampBet = (n: number) => Math.max(1, Math.min(balance, Math.round(n)));

  const handleSelect = (outcomeId: string) => {
    if (active.status !== "open" || myBet) return;
    setSelection((s) => ({ ...s, [active.id]: outcomeId }));
  };

  const handleBetAmount = (n: number) => {
    setAmounts((a) => ({ ...a, [active.id]: clampBet(n) }));
  };

  const handlePlaceBet = () => {
    if (active.status !== "open" || myBet || !selected) return;
    const amt = clampBet(bet);
    if (amt > balance) return;
    setBets((b) => ({ ...b, [active.id]: { outcomeId: selected, amount: amt } }));
    setBalance((b) => b - amt);
    setPools((p) => ({
      ...p,
      [active.id]: {
        ...p[active.id]!,
        [selected]: (p[active.id]![selected] ?? 0) + amt,
      },
    }));
  };

  return (
    <section aria-label="Live predictions" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-red-hat inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-olive/80">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c43a1c] opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-[#c43a1c]" />
          </span>
          Live Predictions
        </h2>

        <div
          className={cn(
            LIQUID_GLASS_PILL_CLASS,
            "font-red-hat inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-olive",
          )}
        >
          <Coins className="size-3.5" />
          <span className="tabular-nums">{balance.toLocaleString()}</span>
          <span className="text-olive/60">coins</span>
        </div>
      </div>

      <motion.article
        key={active.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn(LIQUID_GLASS_CARD_CLASS, "rounded-3xl p-5 sm:p-6")}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-red-hat rounded-full bg-sage/30 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-olive">
              {active.category}
            </span>
            {active.status === "open" ? (
              <span className="font-red-hat rounded-full bg-[#c43a1c]/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#9c2e15]">
                Betting open
              </span>
            ) : active.status === "locked" ? (
              <span className="font-red-hat inline-flex items-center gap-1 rounded-full bg-olive/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-olive">
                <Lock className="size-3" />
                Locked
              </span>
            ) : (
              <span className="font-red-hat inline-flex items-center gap-1 rounded-full bg-sage/45 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-olive">
                <Trophy className="size-3" />
                Resolved
              </span>
            )}
            <span className="font-red-hat text-[11px] text-ink/50 tabular-nums">
              {total.toLocaleString()} coins in pool
            </span>
          </div>
          <span className="font-red-hat text-[11px] uppercase tracking-wider text-ink/45">
            {active.status === "open" && now
              ? formatClosesIn(active.closesAt, now)
              : active.status === "locked"
                ? "Awaiting result"
                : "Payout complete"}
          </span>
        </div>

        <h3 className="font-red-hat text-lg font-semibold leading-snug text-ink sm:text-xl">
          {active.question}
        </h3>

        <div className="mt-4 space-y-2">
          {active.outcomes.map((outcome) => {
            const pool = activePool[outcome.id] ?? 0;
            const pct = total > 0 ? (pool / total) * 100 : 0;
            const odds = oddsFor(outcome.id);
            const isSelected = selected === outcome.id;
            const isMyBet = myBet?.outcomeId === outcome.id;
            const isWinner =
              active.status === "resolved" &&
              active.winningOutcomeId === outcome.id;
            const isLoser =
              active.status === "resolved" &&
              active.winningOutcomeId !== outcome.id;
            const canClick = active.status === "open" && !myBet;

            return (
              <button
                key={outcome.id}
                type="button"
                onClick={() => handleSelect(outcome.id)}
                disabled={!canClick}
                className={cn(
                  "group relative w-full overflow-hidden rounded-2xl border border-olive/12 bg-white/45 px-4 py-3 text-left transition-all duration-200",
                  canClick &&
                    "cursor-pointer hover:-translate-y-0.5 hover:border-olive/30 hover:bg-white/70",
                  isSelected && "border-olive/50 bg-white/75",
                  isMyBet && "border-olive/55",
                  isWinner && "border-[#c43a1c]/45",
                  isLoser && "opacity-55",
                )}
              >
                <motion.span
                  aria-hidden
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  className={cn(
                    "absolute inset-y-0 left-0",
                    isWinner
                      ? "bg-[#c43a1c]/20"
                      : isMyBet
                        ? "bg-olive/22"
                        : "bg-sage/28",
                  )}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {isWinner ? (
                      <Trophy className="size-4 shrink-0 text-[#9c2e15]" />
                    ) : null}
                    <span
                      className={cn(
                        "font-red-hat text-sm font-medium text-ink sm:text-base",
                        isMyBet && "text-olive",
                      )}
                    >
                      {outcome.label}
                    </span>
                    {isMyBet ? (
                      <span className="font-red-hat rounded-full bg-olive/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-olive">
                        Your bet
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-red-hat text-[11px] font-semibold uppercase tracking-wider text-ink/55 tabular-nums">
                      {odds.toFixed(2)}×
                    </span>
                    <span className="font-heading text-sm tabular-nums text-ink/75 sm:text-base">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {active.status === "open" && !myBet ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {BET_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleBetAmount(n)}
                  disabled={n > balance}
                  className={cn(
                    "font-red-hat rounded-full border border-olive/15 bg-white/40 px-3 py-1 text-xs font-semibold text-olive/80 transition-colors hover:border-olive/35 hover:bg-white/70 hover:text-olive disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/40 disabled:hover:text-olive/80",
                    bet === n && "border-olive/45 bg-olive/12 text-olive",
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleBetAmount(balance)}
                className="font-red-hat rounded-full border border-olive/15 bg-white/40 px-3 py-1 text-xs font-semibold text-olive/80 transition-colors hover:border-olive/35 hover:bg-white/70 hover:text-olive"
              >
                All in
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center gap-1 rounded-full border border-olive/15 bg-white/50 px-1">
                <button
                  type="button"
                  onClick={() => handleBetAmount(bet - 10)}
                  className="font-heading rounded-full px-3 py-1.5 text-lg text-olive/70 hover:text-olive"
                  aria-label="Decrease bet"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={balance}
                  value={bet}
                  onChange={(e) =>
                    handleBetAmount(Number(e.target.value) || 1)
                  }
                  className="font-red-hat w-full bg-transparent text-center text-sm font-semibold text-ink tabular-nums outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleBetAmount(bet + 10)}
                  className="font-heading rounded-full px-3 py-1.5 text-lg text-olive/70 hover:text-olive"
                  aria-label="Increase bet"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={handlePlaceBet}
                disabled={!selected || bet < 1 || bet > balance}
                className="font-red-hat inline-flex items-center gap-1.5 rounded-full bg-olive px-4 py-2 text-sm font-semibold text-cream shadow-[0_6px_16px_-4px_rgba(31,42,22,0.35)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                <Coins className="size-4" />
                Place bet
              </button>
            </div>

            <p className="font-red-hat text-[11px] uppercase tracking-wider text-ink/45">
              {selected
                ? `Potential payout: ${Math.round(bet * oddsFor(selected)).toLocaleString()} coins`
                : "Pick an outcome above to place a bet"}
            </p>
          </div>
        ) : null}

        {myBet && active.status === "open" ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive/15 bg-white/50 px-4 py-3">
            <p className="font-red-hat text-xs text-ink/65">
              <span className="font-semibold text-olive">
                {myBet.amount} coins
              </span>{" "}
              on{" "}
              <span className="font-semibold text-ink">
                {active.outcomes.find((o) => o.id === myBet.outcomeId)?.label}
              </span>
            </p>
            <span className="font-heading text-sm tabular-nums text-olive">
              +
              {Math.round(
                myBet.amount * oddsFor(myBet.outcomeId),
              ).toLocaleString()}{" "}
              if wins
            </span>
          </div>
        ) : null}

        {active.status === "locked" ? (
          <div className="mt-4 rounded-2xl border border-olive/15 bg-white/40 px-4 py-3">
            <p className="font-red-hat text-xs text-ink/60">
              Bets are locked. MHacks will resolve this poll once the outcome
              is official.
            </p>
          </div>
        ) : null}

        {active.status === "resolved" && myBet ? (
          <div
            className={cn(
              "mt-4 rounded-2xl border px-4 py-3",
              myBet.outcomeId === active.winningOutcomeId
                ? "border-[#c43a1c]/25 bg-[#c43a1c]/8"
                : "border-olive/15 bg-white/40",
            )}
          >
            {myBet.outcomeId === active.winningOutcomeId ? (
              <p className="font-red-hat text-xs text-[#9c2e15]">
                You won{" "}
                <span className="font-semibold">
                  {Math.round(
                    myBet.amount * oddsFor(myBet.outcomeId),
                  ).toLocaleString()}{" "}
                  coins
                </span>
                . Nice call.
              </p>
            ) : (
              <p className="font-red-hat text-xs text-ink/60">
                You lost {myBet.amount} coins on this one. Better luck next
                round.
              </p>
            )}
          </div>
        ) : null}

      </motion.article>

      <p className="font-red-hat px-1 text-[11px] leading-relaxed text-ink/45">
        inspired by twitch&rsquo;s live prediction system (for context: on
        twitch, a streamer starts a poll related to their stream and users bet
        on the outcome (usually yes/no) and its similar to kalshi where betting
        on the less popular option yields a greater reward), we can give out
        bonuses for interacting with the polls and have limited time events
        where we double the coin economy?
      </p>
    </section>
  );
}

type Announcement = {
  id: string;
  title: string;
  body: string;
  postedAt: string;
  tag?: string;
};

const placeholderAnnouncements: Announcement[] = [
  {
    id: "ann-1",
    tag: "Food",
    title: "Late-night snacks at North Hall",
    body: "Coffee, ramen, and fruit are out near check-in. Come grab something before midnight programming starts.",
    postedAt: "2026-10-03T22:45:00-04:00",
  },
  {
    id: "ann-2",
    tag: "Reminder",
    title: "Submissions close Sunday 12:30 PM",
    body: "Lock your Devpost before the deadline. Late submissions can't be judged this year.",
    postedAt: "2026-10-03T19:00:00-04:00",
  },
  {
    id: "ann-3",
    tag: "Mentors",
    title: "AI mentors available all night in Workshop B",
    body: "Two sponsor mentors are on-deck for help with AI/ML stack questions until 4 AM.",
    postedAt: "2026-10-03T18:20:00-04:00",
  },
];

const QUICK_LINKS = [
  {
    label: "Devpost",
    href: "https://mhacks.devpost.com",
    external: true,
    icon: ArrowUpRight,
  },
  { label: "Maps", href: "/maps", external: false, icon: MapIcon },
  { label: "Resources", href: "/resources", external: false, icon: BookOpen },
  { label: "Prizes", href: "/prizes", external: false, icon: Award },
] as const;

function QuickLinks() {
  return (
    <nav
      aria-label="Quick links"
      className="flex flex-wrap gap-2 sm:gap-3"
    >
      {QUICK_LINKS.map(({ label, href, external, icon: Icon }) => {
        const className = cn(
          "liquid-glass-card font-red-hat group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 sm:text-base",
        );
        const content = (
          <>
            <Icon className="size-4 text-olive" />
            <span>{label}</span>
            {external ? (
              <ArrowUpRight className="size-3.5 text-olive/60 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            ) : null}
          </>
        );
        return external ? (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={className}
          >
            {content}
          </a>
        ) : (
          <Link key={label} href={href} className={className}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

function formatPostedAt(iso: string, now: number) {
  const diff = new Date(iso).getTime() - now;
  const minutes = Math.round(diff / 60_000);
  const absMinutes = Math.abs(minutes);
  if (absMinutes < 60) return relativeTimeFormatter.format(minutes, "minute");
  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) < 24) return relativeTimeFormatter.format(hours, "hour");
  const days = Math.round(diff / 86_400_000);
  return relativeTimeFormatter.format(days, "day");
}

function Announcements({ items }: { items: Announcement[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (items.length === 0) return null;

  return (
    <section aria-label="Announcements" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-red-hat inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-olive/80">
          <Megaphone className="size-4" />
          Announcements
        </h2>
        <span className="font-red-hat text-xs uppercase tracking-wider text-ink/40">
          {items.length} latest
        </span>
      </div>
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <article
            key={item.id}
            className="liquid-glass-card flex w-[280px] shrink-0 flex-col gap-2 rounded-2xl p-4 sm:w-[320px]"
          >
            <div className="flex items-center justify-between gap-2">
              {item.tag ? (
                <span className="font-red-hat rounded-full bg-sage/30 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-olive">
                  {item.tag}
                </span>
              ) : (
                <span />
              )}
              <span className="font-red-hat text-[11px] text-ink/45">
                {now ? formatPostedAt(item.postedAt, now) : ""}
              </span>
            </div>
            <h3 className="font-red-hat text-base font-semibold leading-snug text-ink">
              {item.title}
            </h3>
            <p className="font-red-hat text-sm leading-snug text-ink/65">
              {item.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SearchBar({
  value,
  onChange,
  resultCount,
}: {
  value: string;
  onChange: (v: string) => void;
  resultCount: number | null;
}) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-olive/50" />
      <Input
        type="search"
        placeholder="Search events, locations, types…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          LIQUID_GLASS_PILL_CLASS,
          "font-red-hat h-11 rounded-full border-transparent pl-10 pr-10 text-sm text-ink placeholder:text-ink/40 focus-visible:ring-olive/30",
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-olive/55 transition-colors hover:bg-olive/10 hover:text-olive"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      {value && resultCount !== null ? (
        <span className="font-red-hat absolute -bottom-5 left-4 text-[11px] uppercase tracking-wider text-ink/45">
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </span>
      ) : null}
    </div>
  );
}

type DayItem = { key: string; label: string; events: LiveEvent[] };
type TabRect = { x: number; w: number };

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function useCountdown(targetMs: number | null) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (targetMs == null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  if (now == null || targetMs == null) return null;
  const diff = Math.max(0, targetMs - now);
  return {
    diff,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    mins: Math.floor((diff % 3_600_000) / 60_000),
    secs: Math.floor((diff % 60_000) / 1000),
  };
}

function NextEventCountdown({ events }: { events: LiveEvent[] }) {
  const next = useMemo(() => {
    const now = Date.now();
    return events.find((e) => new Date(e.startsAt).getTime() > now) ?? null;
  }, [events]);

  const countdown = useCountdown(
    next ? new Date(next.startsAt).getTime() : null,
  );

  if (!next || !countdown) return null;

  return (
    <div
      className={cn(
        LIQUID_GLASS_PILL_CLASS,
        "inline-flex w-fit items-center gap-3 rounded-full px-4 py-2",
      )}
    >
      <span className="font-red-hat text-[10px] font-semibold uppercase tracking-[0.18em] text-olive/65">
        until {next.name}
      </span>
      <span className="font-heading text-base text-olive tabular-nums sm:text-lg">
        {countdown.days > 0 ? `${countdown.days}d ` : ""}
        {pad(countdown.hours)}:{pad(countdown.mins)}:{pad(countdown.secs)}
      </span>
    </div>
  );
}

function DayPicker({
  days,
  active,
  onSelect,
}: {
  days: DayItem[];
  active: string;
  onSelect: (key: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [rects, setRects] = useState<Record<string, TabRect>>({});

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const next: Record<string, TabRect> = {};
      days.forEach((day) => {
        const el = tabRefs.current[day.key];
        if (el) {
          const r = el.getBoundingClientRect();
          next[day.key] = { x: r.left - cRect.left, w: r.width };
        }
      });
      setRects(next);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [days]);

  const activeRect = rects[active];

  return (
    <div
      ref={containerRef}
      className={cn(
        LIQUID_GLASS_PILL_CLASS,
        "relative inline-flex rounded-full p-1",
      )}
    >
      {activeRect ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 left-0 z-0 rounded-full bg-olive shadow-[0_1px_0_rgba(255,255,255,0.30)_inset,0_6px_16px_-4px_rgba(31,42,22,0.50)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            transform: `translateX(${activeRect.x}px)`,
            width: activeRect.w,
          }}
        />
      ) : null}

      {days.map((day, index) => {
        const isActive = day.key === active;
        return (
          <button
            key={day.key}
            type="button"
            ref={(el) => {
              tabRefs.current[day.key] = el;
            }}
            onClick={() => onSelect(day.key)}
            className={cn(
              "font-heading relative z-10 inline-flex h-9 items-center justify-center rounded-full px-5 text-base transition-colors duration-300 select-none sm:h-10 sm:px-6 sm:text-lg",
              isActive ? "text-cream" : "text-olive/70 hover:text-olive",
            )}
          >
            Day {index + 1}
          </button>
        );
      })}
    </div>
  );
}

function EventCard({ event }: { event: LiveEvent }) {
  const status = getEventStatus(event);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <article
          className={cn(
            "liquid-glass-card group relative w-full cursor-pointer overflow-hidden rounded-3xl text-left hover:-translate-y-0.5 sm:grid sm:grid-cols-[11rem_1fr_auto] sm:items-center sm:gap-6",
            status === "Past" && "opacity-55",
          )}
        >
          <div className="relative z-10 flex items-baseline gap-2 p-5 sm:flex-col sm:items-start sm:gap-1 sm:p-6 sm:pr-0">
            <p className="font-heading text-2xl leading-none text-olive sm:text-3xl">
              {timeFormatter.format(new Date(event.startsAt))}
            </p>
            {event.endsAt ? (
              <p className="font-red-hat text-xs text-ink/45">
                until {timeFormatter.format(new Date(event.endsAt))}
              </p>
            ) : null}
          </div>

          <div className="relative z-10 min-w-0 px-5 pb-5 sm:px-0 sm:py-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-red-hat truncate text-lg font-semibold text-ink sm:text-xl">
                {event.name}
              </h3>
              <StatusDot status={status} />
            </div>

            <div className="font-red-hat mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/55">
              <span className="rounded-full bg-sage/30 px-2.5 py-0.5 text-[12px] font-medium text-olive">
                {event.eventType}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 opacity-60" />
                {event.location}
              </span>
            </div>
          </div>

          <div className="relative z-10 hidden pr-6 sm:block">
            <span className="font-heading inline-flex h-10 w-10 items-center justify-center rounded-full border border-olive/15 bg-white/40 text-olive/70 transition-all duration-300 group-hover:border-olive/30 group-hover:bg-white/70 group-hover:text-olive">
              <ChevronRight className="size-4" />
            </span>
          </div>
        </article>
      </DrawerTrigger>

      <DrawerContent
        className={cn(
          LIQUID_GLASS_PANEL_CLASS,
          "rounded-t-3xl border-olive/10 text-ink",
        )}
      >
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader className="text-left">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-red-hat rounded-full bg-sage/30 px-2.5 py-0.5 text-[12px] font-medium text-olive">
                {event.eventType}
              </span>
              <StatusDot status={status} />
            </div>
            <DrawerTitle className="font-red-hat text-3xl font-semibold text-ink">
              {event.name}
            </DrawerTitle>
            <DrawerDescription className="font-red-hat text-sm text-ink/65">
              {formatEventTime(event)} · {event.location}
            </DrawerDescription>
          </DrawerHeader>

          <div className="font-red-hat space-y-4 px-4 pb-2 text-sm text-ink/75">
            <p className="leading-6">{event.description}</p>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-olive/10 bg-olive/5 sm:grid-cols-2">
              <div className="bg-white/50 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink/45">
                  Time
                </div>
                <div className="font-red-hat mt-1 font-medium text-ink">
                  {formatEventTime(event)}
                </div>
              </div>
              <div className="bg-white/50 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink/45">
                  Location
                </div>
                <div className="font-red-hat mt-1 font-medium text-ink">
                  {event.location}
                </div>
              </div>
            </div>
          </div>

          <DrawerFooter className="sm:flex-row sm:justify-end">
            {event.mapUrl ? (
              <Button
                asChild
                variant="outline"
                className="rounded-full border-olive/20 bg-white/50 text-olive hover:bg-white/80"
              >
                <a href={event.mapUrl} target="_blank" rel="noreferrer">
                  Open map
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            ) : null}
            <DrawerClose asChild>
              <Button className="rounded-full bg-olive text-cream hover:bg-moss">
                Close
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function LiveEvents({ events, source }: LiveEventsProps) {
  const [showPast, setShowPast] = useState(false);
  const [query, setQuery] = useState("");

  const visibleEvents = useMemo(
    () =>
      showPast
        ? events
        : events.filter((event) => getEventStatus(event) !== "Past"),
    [events, showPast],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const searchActive = normalizedQuery.length > 0;

  const searchResults = useMemo(() => {
    if (!searchActive) return [];
    return events.filter((event) => {
      const haystack =
        `${event.name} ${event.location} ${event.eventType} ${event.description}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [events, normalizedQuery, searchActive]);

  const days = useMemo(() => groupEvents(visibleEvents), [visibleEvents]);
  const allDays = useMemo(() => groupEvents(events), [events]);

  const [activeDay, setActiveDay] = useState(days[0]?.key ?? "");

  // If the currently-active day is filtered out (no upcoming events),
  // jump to the first day that still has visible events.
  useEffect(() => {
    if (days.length === 0) return;
    if (!days.find((day) => day.key === activeDay)) {
      setActiveDay(days[0]!.key);
    }
  }, [days, activeDay]);

  const currentDay = days.find((day) => day.key === activeDay) ?? days[0];
  const pastCount = events.length - visibleEvents.length;

  return (
    <main className="relative min-h-screen bg-paper text-ink">
      <section className="relative overflow-hidden">
        <Image
          src="/hero_bg_w_overlay.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[65%_center] brightness-[0.92] contrast-[1.2] saturate-[1.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-paper" />

        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-5 pt-12 pb-20 sm:px-8 sm:pt-20 sm:pb-28 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span
              className={cn(
                LIQUID_GLASS_PILL_CLASS,
                "font-red-hat inline-flex items-center rounded-full px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-olive",
              )}
            >
              MHacks Live
            </span>
            <h1 className="font-red-hat mt-5 text-5xl font-black uppercase leading-[0.95] tracking-tight text-cream drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:text-7xl">
              Timeline
            </h1>
            <p className="font-heading mt-3 max-w-xl text-lg leading-7 text-cream/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.35)] sm:text-xl">
              Events, workshops, food, and deadlines for the weekend.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div
              className={cn(
                LIQUID_GLASS_PILL_CLASS,
                "font-heading inline-flex w-fit items-center gap-2.5 rounded-full px-4 py-2 text-base text-olive",
              )}
            >
              <CalendarDays className="size-4 opacity-70" />
              Oct 3 – 4, 2026
            </div>
            <NextEventCountdown events={events} />
          </div>
        </div>
      </section>

      <section className="relative mx-auto -mt-10 max-w-5xl space-y-8 px-5 pb-20 sm:px-8">
        <QuickLinks />
        <LivePredictions items={placeholderPredictions} />
        <Announcements items={placeholderAnnouncements} />

        <div className="sticky top-4 z-20 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar
            value={query}
            onChange={setQuery}
            resultCount={searchActive ? searchResults.length : null}
          />
          {!searchActive && days.length > 1 ? (
            <DayPicker
              days={days}
              active={currentDay?.key ?? ""}
              onSelect={setActiveDay}
            />
          ) : null}
        </div>

        {searchActive ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-red-hat text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Search results
              </h2>
              <p className="font-heading text-base text-ink/50">
                {searchResults.length}{" "}
                {searchResults.length === 1 ? "match" : "matches"}
              </p>
            </div>
            {searchResults.length > 0 ? (
              <motion.div
                key={normalizedQuery}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="space-y-3"
              >
                {searchResults.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </motion.div>
            ) : (
              <p className="font-red-hat text-center text-ink/55">
                No events match &ldquo;{query}&rdquo;.
              </p>
            )}
          </div>
        ) : currentDay ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-red-hat text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  {currentDay.label}
                </h2>
                <SourceNote source={source} />
              </div>
              <div className="flex items-center gap-4">
                {pastCount > 0 || showPast ? (
                  <button
                    type="button"
                    onClick={() => setShowPast((s) => !s)}
                    className="font-red-hat text-xs font-medium uppercase tracking-[0.16em] text-olive/65 transition-colors hover:text-olive"
                  >
                    {showPast ? "Hide past events" : `Show past events`}
                  </button>
                ) : null}
                <p className="font-heading text-base text-ink/50 sm:text-lg">
                  {currentDay.events.length}{" "}
                  {currentDay.events.length === 1 ? "event" : "events"}
                </p>
              </div>
            </div>
            <motion.div
              key={`${currentDay.key}-${showPast ? "all" : "upcoming"}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="space-y-3"
            >
              {currentDay.events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </motion.div>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="font-red-hat text-ink/55">
              No upcoming events left.
            </p>
            {allDays.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowPast(true)}
                className="font-red-hat text-sm font-medium uppercase tracking-[0.16em] text-olive transition-colors hover:text-moss"
              >
                Show past events
              </button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
