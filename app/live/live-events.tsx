"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  House,
  Lock,
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
  DAY_PICKER_GLASS_CLASS,
  LIQUID_GLASS_CARD_CLASS,
  LIQUID_GLASS_PANEL_CLASS,
  LIQUID_GLASS_PILL_CLASS,
} from "@/lib/glass";
import { useScrollDirection } from "@/lib/landing/useScrollDirection";
import { cn } from "@/lib/utils";
import type { LiveEvent } from "./schedule";

const EVENT_TIME_ZONE = "America/Detroit";

type LiveEventsProps = {
  events: readonly LiveEvent[];
};

function useCurrentTime(intervalMs: number, enabled = true) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => setNow(Date.now());
    const timeoutId = window.setTimeout(tick, 0);
    const intervalId = window.setInterval(tick, intervalMs);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs]);

  return now;
}

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

const dateRangeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
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

function formatScheduleRange(events: readonly LiveEvent[]) {
  const first = events[0];
  const last = events.at(-1);
  if (!first || !last) return null;

  return dateRangeFormatter
    .formatRange(new Date(first.startsAt), new Date(last.startsAt))
    .replace(/\s*–\s*/u, " – ");
}

function getEventStatus(event: LiveEvent, now: number | null) {
  if (now === null) return "Upcoming" as const;

  const start = new Date(event.startsAt).getTime();
  const end = event.endsAt ? new Date(event.endsAt).getTime() : start;

  if (now >= start && now <= end) return "Live" as const;
  if (now < start) return "Upcoming" as const;
  return "Past" as const;
}

function groupEvents(events: readonly LiveEvent[]) {
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

function StatusLabel({
  status,
}: {
  status: ReturnType<typeof getEventStatus>;
}) {
  if (status === "Live") {
    return (
      <span className="font-red-hat inline-flex items-center rounded-full bg-sage/45 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-olive">
        Live
      </span>
    );
  }

  if (status === "Past") {
    return (
      <span className="font-red-hat text-[11px] font-medium uppercase tracking-wider text-ink/60">
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
  const now = useCurrentTime(30_000);

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
    setBets((b) => ({
      ...b,
      [active.id]: { outcomeId: selected, amount: amt },
    }));
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
        <h2 className="font-red-hat text-sm font-semibold uppercase tracking-[0.18em] text-olive">
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
          <span className="text-olive">coins</span>
        </div>
      </div>

      <motion.article
        key={active.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn(LIQUID_GLASS_CARD_CLASS, "rounded-lg p-5 sm:p-6")}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-red-hat rounded-full bg-olive/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-olive">
              {active.category}
            </span>
            {active.status === "open" ? (
              <span className="font-red-hat rounded-full bg-sage/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-olive">
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
            <span className="font-red-hat text-[11px] font-medium text-ink/80 tabular-nums">
              {total.toLocaleString()} coins in pool
            </span>
          </div>
          <span className="font-red-hat text-[11px] font-semibold uppercase tracking-wider text-ink/75">
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
                  "group relative w-full overflow-hidden rounded-md border border-olive/12 bg-white/45 px-4 py-3 text-left transition-all duration-200",
                  canClick &&
                    "cursor-pointer hover:-translate-y-0.5 hover:border-olive/30 hover:bg-white/70",
                  isSelected && "border-olive/50 bg-white/75",
                  isMyBet && "border-olive/55",
                  isWinner && "border-olive/45",
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
                      ? "bg-sage/45"
                      : isMyBet
                        ? "bg-olive/22"
                        : "bg-sage/28",
                  )}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {isWinner ? (
                      <Trophy className="size-4 shrink-0 text-olive" />
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
                    <span className="font-red-hat text-[11px] font-semibold uppercase tracking-wider text-ink/75 tabular-nums">
                      {odds.toFixed(2)}×
                    </span>
                    <span className="font-red-hat text-sm tabular-nums text-ink/75 sm:text-base">
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
                    "font-red-hat rounded-full border border-olive/15 bg-white/40 px-3 py-1 text-xs font-semibold text-olive transition-colors hover:border-olive/35 hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/40",
                    bet === n && "border-olive/45 bg-olive/12 text-olive",
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleBetAmount(balance)}
                className="font-red-hat rounded-full border border-olive/15 bg-white/40 px-3 py-1 text-xs font-semibold text-olive transition-colors hover:border-olive/35 hover:bg-white/70"
              >
                All in
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center gap-1 rounded-full border border-olive/15 bg-white/50 px-1">
                <button
                  type="button"
                  onClick={() => handleBetAmount(bet - 10)}
                  className="font-red-hat rounded-full px-3 py-1.5 text-lg text-olive"
                  aria-label="Decrease bet"
                >
                  −
                </button>
                <input
                  type="number"
                  aria-label="Bet amount"
                  min={1}
                  max={balance}
                  value={bet}
                  onChange={(e) => handleBetAmount(Number(e.target.value) || 1)}
                  className="font-red-hat w-full bg-transparent text-center text-sm font-semibold text-ink tabular-nums outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleBetAmount(bet + 10)}
                  className="font-red-hat rounded-full px-3 py-1.5 text-lg text-olive"
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

            <p className="font-red-hat text-[11px] font-medium uppercase tracking-wider text-ink/75">
              {selected
                ? `Potential payout: ${Math.round(bet * oddsFor(selected)).toLocaleString()} coins`
                : "Pick an outcome above to place a bet"}
            </p>
          </div>
        ) : null}

        {myBet && active.status === "open" ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive/15 bg-white/50 px-4 py-3">
            <p className="font-red-hat text-xs text-ink/75">
              <span className="font-semibold text-olive">
                {myBet.amount} coins
              </span>{" "}
              on{" "}
              <span className="font-semibold text-ink">
                {active.outcomes.find((o) => o.id === myBet.outcomeId)?.label}
              </span>
            </p>
            <span className="font-red-hat text-sm tabular-nums text-olive">
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
            <p className="font-red-hat text-xs text-ink/75">
              Bets are locked. MHacks will resolve this poll once the outcome is
              official.
            </p>
          </div>
        ) : null}

        {active.status === "resolved" && myBet ? (
          <div
            className={cn(
              "mt-4 rounded-2xl border px-4 py-3",
              myBet.outcomeId === active.winningOutcomeId
                ? "border-olive/25 bg-sage/25"
                : "border-olive/15 bg-white/40",
            )}
          >
            {myBet.outcomeId === active.winningOutcomeId ? (
              <p className="font-red-hat text-xs text-olive">
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
              <p className="font-red-hat text-xs text-ink/75">
                You lost {myBet.amount} coins on this one. Better luck next
                round.
              </p>
            )}
          </div>
        ) : null}
      </motion.article>
    </section>
  );
}

type Announcement = {
  id: string;
  title: string;
  body: string;
  postedAt?: string;
  tag?: string;
};

const placeholderAnnouncements: Announcement[] = [
  {
    id: "sample-announcement",
    tag: "Sample",
    title: "Sample announcement",
    body: "Important event updates, schedule changes, and attendee reminders will appear here during the hackathon.",
  },
];

const CURRENCY_EARNERS = [
  {
    label: "Workshop streak",
    reward: "40-120",
    detail:
      "Teams earn a multiplier when multiple teammates check into back-to-back sessions.",
  },
  {
    label: "Mini competitions",
    reward: "25-150",
    detail:
      "Side quests like scavenger hunts, blackjack, and sponsor challenges break attendance ties.",
  },
  {
    label: "Project milestones",
    reward: "50-250",
    detail:
      "Track wins, demo readiness, and sponsor engagement can feed the team balance.",
  },
] as const;

const CURRENCY_REWARDS = [
  { item: "Matcha", price: 80 },
  { item: "Late-night ramen", price: 120 },
  { item: "Bucket hat", price: 300 },
  { item: "Bonus raffle entry", price: 450 },
] as const;

const LEADERBOARD_PREVIEW = [
  { team: "North Quad Night Shift", coins: 1240, delta: "+220" },
  { team: "The Arboretum", coins: 1110, delta: "+180" },
  { team: "Maize Market Makers", coins: 980, delta: "+340" },
] as const;

function QuickLinks() {
  return (
    <nav aria-label="Quick links" className="flex flex-wrap gap-2">
      <Link
        href="/"
        className="liquid-glass-card font-red-hat group inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 sm:text-base"
      >
        <House className="size-4 text-olive" />
        <span>MHacks home</span>
        <ArrowUpRight className="size-3.5 text-olive/60 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
      <Link
        href="#"
        aria-disabled="true"
        onClick={(event) => event.preventDefault()}
        className="liquid-glass-card font-red-hat inline-flex cursor-not-allowed items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-ink/65 sm:text-base"
      >
        <ExternalLink className="size-4 text-olive/65" />
        <span>Devpost</span>
        <span className="text-xs font-medium uppercase text-ink/45">
          Coming soon
        </span>
      </Link>
    </nav>
  );
}

function CurrencySystem() {
  return (
    <section aria-label="Currency system" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-red-hat inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-olive">
            <Coins className="size-4" />
            Currency
          </h2>
          <p className="font-red-hat mt-1 text-base leading-6 text-ink/75">
            Earn at events, spend on small rewards, or save as a team for the
            currency track.
          </p>
        </div>
        <div
          className={cn(
            LIQUID_GLASS_PILL_CLASS,
            "font-red-hat inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-olive",
          )}
        >
          Concept preview
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div
          className={cn(LIQUID_GLASS_PANEL_CLASS, "self-start rounded-md p-5")}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-red-hat text-lg font-bold text-ink">
              Ways to earn
            </h3>
            <span className="font-red-hat rounded-full bg-sage/30 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-olive">
              Team weighted
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {CURRENCY_EARNERS.map((item) => (
              <article
                key={item.label}
                className="rounded-md border border-olive/10 bg-white/45 p-4"
              >
                <div className="font-red-hat text-2xl text-olive tabular-nums">
                  {item.reward}
                </div>
                <h4 className="font-red-hat mt-2 text-sm font-semibold text-ink">
                  {item.label}
                </h4>
                <p className="font-red-hat mt-1 text-xs leading-5 text-ink/75">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className={cn(LIQUID_GLASS_CARD_CLASS, "rounded-md p-5")}>
            <h3 className="font-red-hat mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-olive">
              <Award className="size-4" />
              Spend menu
            </h3>
            <div className="space-y-2">
              {CURRENCY_REWARDS.map((reward) => (
                <div
                  key={reward.item}
                  className="flex items-center justify-between gap-3 rounded-md bg-white/45 px-3 py-2"
                >
                  <span className="font-red-hat text-sm font-medium text-ink">
                    {reward.item}
                  </span>
                  <span className="font-red-hat text-sm text-olive tabular-nums">
                    {reward.price}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(LIQUID_GLASS_CARD_CLASS, "rounded-md p-5")}>
            <h3 className="font-red-hat mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-olive">
              <Trophy className="size-4" />
              Leaderboard
            </h3>
            <div className="space-y-2">
              {LEADERBOARD_PREVIEW.map((team, index) => (
                <div
                  key={team.team}
                  className="flex items-center justify-between gap-3 rounded-md bg-white/45 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-red-hat truncate text-sm font-medium text-ink">
                      {index + 1}. {team.team}
                    </div>
                    <div className="font-red-hat text-[11px] text-ink/70">
                      {team.delta} today
                    </div>
                  </div>
                  <span className="font-red-hat text-sm text-olive tabular-nums">
                    {team.coins.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
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
  const now = useCurrentTime(60_000);

  if (items.length === 0) return null;

  return (
    <section aria-label="Announcements" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-red-hat inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-olive">
          <Megaphone className="size-4" />
          Announcements
        </h2>
      </div>
      <div aria-label="Latest announcements" role="region">
        {items.map((item) => (
          <article
            key={item.id}
            className="liquid-glass-card flex w-full flex-col gap-2 rounded-md p-4"
          >
            <div className="flex items-center justify-between gap-2">
              {item.tag ? (
                <span className="font-red-hat rounded-full bg-sage/30 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-olive">
                  {item.tag}
                </span>
              ) : (
                <span />
              )}
              {item.postedAt && now ? (
                <span className="font-red-hat text-[11px] text-ink/70">
                  {formatPostedAt(item.postedAt, now)}
                </span>
              ) : null}
            </div>
            <h3 className="font-red-hat text-base font-semibold leading-snug text-ink">
              {item.title}
            </h3>
            <p className="font-red-hat text-sm leading-snug text-ink/75">
              {item.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

type LiveView = "timeline" | "predictions" | "guide" | "prizes";

function LiveViewTabs({
  active,
  onSelect,
  idPrefix = "inline",
  interactive = true,
  variant = "inline",
}: {
  active: LiveView;
  onSelect: (view: LiveView) => void;
  idPrefix?: "inline" | "floating";
  interactive?: boolean;
  variant?: "inline" | "floating";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<LiveView, HTMLButtonElement | null>>({
    timeline: null,
    predictions: null,
    guide: null,
    prizes: null,
  });
  const views = [
    {
      id: "timeline" as const,
      label: "Timeline",
      shortLabel: "Timeline",
      icon: CalendarDays,
    },
    {
      id: "predictions" as const,
      label: "Predictions",
      shortLabel: "Predict",
      icon: Coins,
    },
    {
      id: "guide" as const,
      label: "Hacker Guide",
      shortLabel: "Guide",
      icon: BookOpen,
    },
    {
      id: "prizes" as const,
      label: "Prizes",
      shortLabel: "Prizes",
      icon: Trophy,
    },
  ];

  useEffect(() => {
    const container = containerRef.current;
    const tab = tabRefs.current[active];
    if (!container || !tab) return;

    container.scrollTo({
      behavior: "smooth",
      left: tab.offsetLeft - (container.clientWidth - tab.offsetWidth) / 2,
    });
  }, [active]);

  return (
    <div
      ref={containerRef}
      aria-label={
        variant === "inline" ? "Live page views" : "Floating live page views"
      }
      aria-hidden={!interactive}
      className={cn(
        "flex gap-5 overflow-x-auto [scrollbar-width:none] sm:gap-10 [&::-webkit-scrollbar]:hidden",
        variant === "inline"
          ? "-mx-5 border-b border-olive/15 px-5 sm:mx-0 sm:px-0"
          : "gap-2 px-1 sm:justify-center sm:gap-10 sm:px-2",
      )}
      role="tablist"
    >
      {views.map(({ id, label, shortLabel, icon: Icon }) => {
        const isActive = active === id;

        return (
          <button
            key={id}
            id={idPrefix === "inline" ? `${id}-tab` : `${id}-floating-tab`}
            ref={(element) => {
              tabRefs.current[id] = element;
            }}
            type="button"
            aria-label={label}
            aria-controls={`${id}-panel`}
            aria-selected={isActive}
            onClick={() => onSelect(id)}
            tabIndex={interactive ? 0 : -1}
            className={cn(
              "font-red-hat relative inline-flex shrink-0 items-center gap-2 px-1 text-sm font-semibold whitespace-nowrap uppercase tracking-[0.14em] transition-colors",
              variant === "inline"
                ? "h-12 sm:h-14 sm:text-base"
                : "h-11 gap-1.5 text-[11px] tracking-[0.08em] sm:h-12 sm:gap-2 sm:text-sm sm:tracking-[0.14em]",
              isActive ? "text-olive" : "text-ink/70 hover:text-ink",
            )}
            role="tab"
          >
            <Icon className="size-4" />
            {variant === "floating" ? (
              <>
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </>
            ) : (
              label
            )}
            {isActive ? (
              <motion.span
                layoutId={`live-view-indicator-${variant}`}
                className="absolute inset-x-0 -bottom-px h-0.5 bg-olive"
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function FloatingLiveNav({
  active,
  onSelect,
  visible,
}: {
  active: LiveView;
  onSelect: (view: LiveView) => void;
  visible: boolean;
}) {
  return (
    <motion.header
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -96 }}
      transition={{ duration: 0.38, ease: [0.2, 0.8, 0.2, 1] }}
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4"
    >
      <div
        className={cn(
          LIQUID_GLASS_PANEL_CLASS,
          "mx-auto max-w-5xl overflow-hidden rounded-md border-white/50 bg-paper/85 px-2 shadow-[0_10px_34px_rgba(29,36,18,0.14)] backdrop-blur-xl",
          visible ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <LiveViewTabs
          active={active}
          onSelect={onSelect}
          idPrefix="floating"
          interactive={visible}
          variant="floating"
        />
      </div>
    </motion.header>
  );
}

function EventCategoryFilter({
  categories,
  active,
  onSelect,
}: {
  categories: readonly string[];
  active: string;
  onSelect: (category: string) => void;
}) {
  return (
    <div
      aria-label="Event categories"
      className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      role="group"
      tabIndex={0}
    >
      {categories.map((category) => {
        const isActive = category === active;

        return (
          <button
            key={category}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(category)}
            className={cn(
              "font-red-hat shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
              isActive
                ? "border-olive bg-olive text-cream"
                : "border-olive/20 bg-white/55 text-olive hover:border-olive/40 hover:bg-white",
            )}
          >
            {category}
          </button>
        );
      })}
    </div>
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
    <div className="w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-olive/50" />
        <Input
          type="search"
          placeholder="Search events, locations, types…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            LIQUID_GLASS_PILL_CLASS,
            "font-red-hat h-11 appearance-none rounded-lg border-transparent pl-10 pr-10 text-sm text-ink placeholder:text-ink/65 focus-visible:ring-olive/30 [&::-webkit-search-cancel-button]:appearance-none",
          )}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-olive transition-colors hover:bg-olive/10"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      {value && resultCount !== null ? (
        <p className="font-red-hat ml-1 mt-2 text-[11px] uppercase tracking-wider text-ink/70">
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </p>
      ) : null}
    </div>
  );
}

type DayItem = { key: string; label: string; events: LiveEvent[] };
type TabRect = { x: number; w: number };

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function getCountdown(targetMs: number | null, now: number | null) {
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

function NextEventCountdown({ events }: { events: readonly LiveEvent[] }) {
  const now = useCurrentTime(1000);
  const next = useMemo(() => {
    if (now == null) return null;
    return events.find((e) => new Date(e.startsAt).getTime() > now) ?? null;
  }, [events, now]);

  const countdown = getCountdown(
    next ? new Date(next.startsAt).getTime() : null,
    now,
  );

  if (!next || !countdown) return null;

  return (
    <div
      className={cn(
        LIQUID_GLASS_PILL_CLASS,
        "liquid-glass-surface-strong inline-flex w-fit items-center gap-3 rounded-md border-olive/15 bg-paper/90 px-4 py-2 shadow-[0_10px_30px_-14px_rgba(31,42,22,0.45)]",
      )}
    >
      <span className="font-red-hat text-[10px] font-bold uppercase tracking-[0.18em] text-olive/85">
        until {next.name}
      </span>
      <span className="font-red-hat text-base text-olive tabular-nums sm:text-lg">
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
      aria-label="Schedule day"
      className={cn(
        DAY_PICKER_GLASS_CLASS,
        "relative inline-flex rounded-full p-1",
      )}
      role="group"
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
            aria-pressed={isActive}
            onClick={() => onSelect(day.key)}
            className={cn(
              "font-red-hat relative z-10 inline-flex h-9 items-center justify-center rounded-full px-5 text-base transition-colors duration-300 select-none sm:h-10 sm:px-6 sm:text-lg",
              isActive ? "text-cream" : "text-olive",
            )}
          >
            Day {index + 1}
          </button>
        );
      })}
    </div>
  );
}

function EventCard({ event, now }: { event: LiveEvent; now: number | null }) {
  const status = getEventStatus(event, now);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button
          type="button"
          className={cn(
            "liquid-glass-card group relative w-full cursor-pointer overflow-hidden rounded-md text-left hover:-translate-y-0.5 sm:grid sm:grid-cols-[11rem_1fr_auto] sm:items-center sm:gap-6",
            status === "Past" && "opacity-55",
          )}
        >
          <div className="relative z-10 flex items-baseline gap-2 p-5 sm:flex-col sm:items-start sm:gap-1 sm:p-6 sm:pr-0">
            <p className="font-red-hat text-2xl leading-none text-olive sm:text-3xl">
              {timeFormatter.format(new Date(event.startsAt))}
            </p>
            {event.endsAt ? (
              <p className="font-red-hat text-xs text-ink/70">
                until {timeFormatter.format(new Date(event.endsAt))}
              </p>
            ) : null}
          </div>

          <div className="relative z-10 min-w-0 px-5 pb-5 sm:px-0 sm:py-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-red-hat break-words text-lg font-semibold text-ink sm:text-xl">
                {event.name}
              </h3>
              <StatusLabel status={status} />
            </div>

            <div className="font-red-hat mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/75">
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
            <span className="font-red-hat inline-flex h-10 w-10 items-center justify-center rounded-full border border-olive/15 bg-white/40 text-olive transition-all duration-300 group-hover:border-olive/30 group-hover:bg-white/70">
              <ChevronRight className="size-4" />
            </span>
          </div>
        </button>
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
              <StatusLabel status={status} />
            </div>
            <DrawerTitle className="font-red-hat text-3xl font-semibold text-ink">
              {event.name}
            </DrawerTitle>
            <DrawerDescription className="font-red-hat text-sm text-ink/75">
              {formatEventTime(event)} · {event.location}
            </DrawerDescription>
          </DrawerHeader>

          <div className="font-red-hat space-y-4 px-4 pb-2 text-sm text-ink/75">
            <p className="leading-6">{event.description}</p>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-olive/10 bg-olive/5 sm:grid-cols-2">
              <div className="bg-white/50 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink/70">
                  Time
                </div>
                <div className="font-red-hat mt-1 font-medium text-ink">
                  {formatEventTime(event)}
                </div>
              </div>
              <div className="bg-white/50 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink/70">
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

export function LiveEvents({ events }: LiveEventsProps) {
  const [activeView, setActiveView] = useState<LiveView>("timeline");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showPast, setShowPast] = useState(false);
  const [query, setQuery] = useState("");
  const [tabsPassed, setTabsPassed] = useState(false);
  const tabsAnchorRef = useRef<HTMLDivElement>(null);
  const scrollNavVisible = useScrollDirection({ threshold: 6, minScroll: 80 });
  const now = useCurrentTime(30_000);

  useEffect(() => {
    const anchor = tabsAnchorRef.current;
    if (!anchor) return;

    const observer = new IntersectionObserver(([entry]) => {
      setTabsPassed(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(events.map((event) => event.eventType))),
    ],
    [events],
  );

  const matchesCategory = useCallback(
    (event: LiveEvent) =>
      activeCategory === "All" || event.eventType === activeCategory,
    [activeCategory],
  );

  const visibleEvents = useMemo(
    () =>
      showPast
        ? events
        : events.filter((event) => getEventStatus(event, now) !== "Past"),
    [events, now, showPast],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const searchActive = normalizedQuery.length > 0;

  const searchResults = useMemo(() => {
    if (!searchActive) return [];
    return events.filter((event) => {
      if (!matchesCategory(event)) return false;
      const haystack =
        `${event.name} ${event.location} ${event.eventType} ${event.description}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [events, matchesCategory, normalizedQuery, searchActive]);

  const days = useMemo(() => groupEvents(visibleEvents), [visibleEvents]);
  const allDays = useMemo(() => groupEvents(events), [events]);

  const [activeDay, setActiveDay] = useState(days[0]?.key ?? "");

  const currentDay = days.find((day) => day.key === activeDay) ?? days[0];
  const currentDayEvents = currentDay?.events.filter(matchesCategory) ?? [];
  const pastCount = events.length - visibleEvents.length;
  const scheduleRange = formatScheduleRange(events);
  const showFloatingNav = tabsPassed && scrollNavVisible;

  return (
    <main className="font-red-hat relative min-h-screen bg-paper text-ink">
      <FloatingLiveNav
        active={activeView}
        onSelect={setActiveView}
        visible={showFloatingNav}
      />

      <section className="relative overflow-hidden">
        <Image
          src="/hero_bg_w_overlay.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-[1.025] object-cover object-[65%_center] brightness-[0.82] contrast-[1.15] saturate-[1.3] blur-[3px]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-paper" />

        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-5 pt-12 pb-20 sm:px-8 sm:pt-20 sm:pb-28 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span
              className={cn(
                LIQUID_GLASS_PILL_CLASS,
                "liquid-glass-surface-strong font-red-hat inline-flex items-center rounded-full border-olive/15 bg-paper/90 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-olive shadow-[0_10px_30px_-14px_rgba(31,42,22,0.45)]",
              )}
            >
              MHacks Live
            </span>
            <h1 className="font-red-hat mt-5 text-5xl font-black uppercase leading-[0.95] tracking-tight text-cream drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:text-7xl">
              Timeline
            </h1>
            <p className="font-red-hat mt-3 max-w-xl text-lg font-medium leading-7 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-xl">
              Events, workshops, food, and deadlines for the weekend.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            {scheduleRange ? (
              <div
                className={cn(
                  LIQUID_GLASS_PILL_CLASS,
                  "liquid-glass-surface-strong font-red-hat inline-flex w-fit items-center gap-2.5 rounded-md border-olive/15 bg-paper/90 px-4 py-2 text-base text-olive shadow-[0_10px_30px_-14px_rgba(31,42,22,0.45)]",
                )}
              >
                <CalendarDays className="size-4 opacity-70" />
                {scheduleRange}
              </div>
            ) : null}
            <NextEventCountdown events={events} />
          </div>
        </div>
      </section>

      <section className="relative mx-auto -mt-10 max-w-5xl px-5 pb-20 sm:px-8">
        <div className="space-y-6 sm:space-y-8">
          <QuickLinks />
          <div ref={tabsAnchorRef}>
            <LiveViewTabs
              active={activeView}
              onSelect={setActiveView}
              interactive={!tabsPassed}
            />
          </div>

          {activeView === "timeline" ? (
            <motion.div
              id="timeline-panel"
              role="tabpanel"
              aria-labelledby="timeline-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="space-y-9 sm:space-y-11"
            >
              <section aria-labelledby="schedule-heading" className="space-y-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2
                      id="schedule-heading"
                      className="font-red-hat text-3xl font-bold tracking-tight text-ink sm:text-4xl"
                    >
                      Schedule
                    </h2>
                    <p className="font-red-hat text-xs text-ink/70">
                      Times shown in Eastern Time. Schedule subject to change.
                    </p>
                  </div>
                  <p className="font-red-hat text-base text-ink/70 sm:text-lg">
                    {events.length} events
                  </p>
                </div>

                <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
                  <SearchBar
                    value={query}
                    onChange={setQuery}
                    resultCount={searchActive ? searchResults.length : null}
                  />
                  {!searchActive && days.length > 1 ? (
                    <div className="justify-self-center sm:justify-self-end">
                      <DayPicker
                        days={days}
                        active={currentDay?.key ?? ""}
                        onSelect={setActiveDay}
                      />
                    </div>
                  ) : null}
                </div>

                <EventCategoryFilter
                  categories={categories}
                  active={activeCategory}
                  onSelect={setActiveCategory}
                />

                {searchActive ? (
                  <div className="space-y-4">
                    <div className="flex items-end justify-between gap-3">
                      <h3 className="font-red-hat text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                        Search results
                      </h3>
                      <p className="font-red-hat text-base text-ink/70">
                        {searchResults.length}{" "}
                        {searchResults.length === 1 ? "match" : "matches"}
                      </p>
                    </div>
                    {searchResults.length > 0 ? (
                      <motion.div
                        key={`${normalizedQuery}-${activeCategory}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="space-y-3"
                      >
                        {searchResults.map((event) => (
                          <EventCard key={event.id} event={event} now={now} />
                        ))}
                      </motion.div>
                    ) : (
                      <p className="font-red-hat py-8 text-center text-ink/75">
                        No events match &ldquo;{query}&rdquo;.
                      </p>
                    )}
                  </div>
                ) : currentDay ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <h3 className="font-red-hat text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                        {currentDay.label}
                      </h3>
                      <div className="flex items-center gap-4">
                        {pastCount > 0 || showPast ? (
                          <button
                            type="button"
                            onClick={() => setShowPast((value) => !value)}
                            className="font-red-hat text-xs font-medium uppercase tracking-[0.16em] text-olive transition-colors hover:text-moss"
                          >
                            {showPast ? "Hide past events" : "Show past events"}
                          </button>
                        ) : null}
                        <p className="font-red-hat text-base text-ink/70 sm:text-lg">
                          {currentDayEvents.length}{" "}
                          {currentDayEvents.length === 1 ? "event" : "events"}
                        </p>
                      </div>
                    </div>

                    {currentDayEvents.length > 0 ? (
                      <motion.div
                        key={`${currentDay.key}-${activeCategory}-${showPast ? "all" : "upcoming"}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="space-y-3"
                      >
                        {currentDayEvents.map((event) => (
                          <EventCard key={event.id} event={event} now={now} />
                        ))}
                      </motion.div>
                    ) : (
                      <div className="space-y-3 py-8 text-center">
                        <p className="font-red-hat text-ink/75">
                          No {activeCategory.toLowerCase()} events on this day.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveCategory("All")}
                          className="font-red-hat text-sm font-semibold text-olive hover:text-moss"
                        >
                          Show all categories
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 py-8 text-center">
                    <p className="font-red-hat text-ink/75">
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

              <Announcements items={placeholderAnnouncements} />
            </motion.div>
          ) : activeView === "predictions" ? (
            <motion.div
              id="predictions-panel"
              role="tabpanel"
              aria-labelledby="predictions-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="space-y-9 sm:space-y-11"
            >
              <LivePredictions items={placeholderPredictions} />
              <CurrencySystem />
            </motion.div>
          ) : activeView === "guide" ? (
            <motion.div
              id="guide-panel"
              role="tabpanel"
              aria-labelledby="guide-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          ) : (
            <motion.div
              id="prizes-panel"
              role="tabpanel"
              aria-labelledby="prizes-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          )}
        </div>
      </section>
    </main>
  );
}
