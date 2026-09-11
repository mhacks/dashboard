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
import { toast } from "sonner";
import {
  ArrowUpRight,
  BookOpen,
  CalendarPlus,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  House,
  MapPin,
  Megaphone,
  Search,
  Share2,
  Trophy,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DAY_PICKER_GLASS_CLASS,
  LIQUID_GLASS_CARD_CLASS,
  LIQUID_GLASS_PANEL_CLASS,
  LIQUID_GLASS_PILL_CLASS,
} from "@/lib/glass";
import { useScrollDirection } from "@/lib/landing/useScrollDirection";
import type {
  GuideLink,
  LiveAnnouncement,
  LiveEvent,
  LiveSiteSettings,
  Prize,
} from "@/lib/live/types";
import { cn } from "@/lib/utils";

type LiveEventsProps = {
  announcements: readonly LiveAnnouncement[];
  events: readonly LiveEvent[];
  guideLinks: readonly GuideLink[];
  prizes: readonly Prize[];
  settings: LiveSiteSettings;
};

type ComingSoonContent = {
  eyebrow: string;
  title: string;
  description: string;
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

function timeFormatter(timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function dayKey(isoDate: string, timezone: string) {
  const date = new Date(isoDate);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatEventTime(event: LiveEvent, timezone: string) {
  const formatter = timeFormatter(timezone);
  const start = formatter.format(new Date(event.startsAt));
  if (!event.endsAt) return start;
  return `${start} – ${formatter.format(new Date(event.endsAt))}`;
}

function formatScheduleRange(events: readonly LiveEvent[], timezone: string) {
  const first = events[0];
  const last = events.at(-1);
  if (!first || !last) return null;

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: timezone,
    year: "numeric",
  })
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

function groupEvents(events: readonly LiveEvent[], timezone: string) {
  const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });

  return events.reduce<
    Array<{ key: string; label: string; events: LiveEvent[] }>
  >((days, event) => {
    const key = dayKey(event.startsAt, timezone);
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

function QuickLinks({ devpostUrl }: { devpostUrl: string | null }) {
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
      {devpostUrl ? (
        <a
          href={devpostUrl}
          target="_blank"
          rel="noreferrer"
          className="liquid-glass-card font-red-hat group inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 sm:text-base"
        >
          <ExternalLink className="size-4 text-olive" />
          <span>Devpost</span>
          <ArrowUpRight className="size-3.5 text-olive/60 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      ) : (
        <span className="liquid-glass-card font-red-hat inline-flex cursor-not-allowed items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-ink/65 sm:text-base">
          <ExternalLink className="size-4 text-olive/65" />
          <span>Devpost</span>
          <span className="text-xs font-medium uppercase text-ink/45">
            Coming soon
          </span>
        </span>
      )}
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

function Announcements({ items }: { items: readonly LiveAnnouncement[] }) {
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
              <span
                className={cn(
                  "font-red-hat rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
                  item.tone === "urgent"
                    ? "bg-destructive/10 text-destructive"
                    : item.tone === "important"
                      ? "bg-amber-200/55 text-amber-950"
                      : "bg-sage/30 text-olive",
                )}
              >
                {item.tone}
              </span>
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

function ComingSoonState({
  content,
  icon: Icon,
}: {
  content: ComingSoonContent;
  icon: LucideIcon;
}) {
  return (
    <section
      className={cn(
        LIQUID_GLASS_PANEL_CLASS,
        "flex min-h-72 flex-col items-center justify-center rounded-md px-6 py-14 text-center",
      )}
      aria-labelledby={`${content.eyebrow.toLowerCase().replaceAll(" ", "-")}-coming-soon`}
    >
      <div className="flex size-12 items-center justify-center rounded-md border border-olive/15 bg-white/55 text-olive">
        <Icon className="size-5" />
      </div>
      <p className="font-red-hat mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-olive">
        {content.eyebrow}
      </p>
      <h2
        id={`${content.eyebrow.toLowerCase().replaceAll(" ", "-")}-coming-soon`}
        className="font-red-hat mt-2 text-2xl font-bold text-ink sm:text-3xl"
      >
        {content.title}
      </h2>
      <p className="font-red-hat mt-3 max-w-xl text-sm leading-6 text-ink/75 sm:text-base">
        {content.description}
      </p>
    </section>
  );
}

function GuidePanel({
  emptyState,
  links,
}: {
  emptyState: ComingSoonContent;
  links: readonly GuideLink[];
}) {
  if (links.length === 0) {
    return <ComingSoonState content={emptyState} icon={BookOpen} />;
  }

  return (
    <section aria-labelledby="guide-heading" className="space-y-4">
      <h2
        id="guide-heading"
        className="font-red-hat text-3xl font-bold text-ink sm:text-4xl"
      >
        Hacker guide
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className={cn(
              LIQUID_GLASS_CARD_CLASS,
              "group rounded-md p-5 transition-transform hover:-translate-y-0.5",
            )}
          >
            <span className="font-red-hat mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-olive/75">
              {link.category}
            </span>
            <span className="flex items-center justify-between gap-3">
              <span className="font-red-hat text-lg font-semibold text-ink">
                {link.title}
              </span>
              <ExternalLink className="size-4 shrink-0 text-olive" />
            </span>
            <span className="font-red-hat mt-2 block text-sm leading-6 text-ink/75">
              {link.description}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function PrizesPanel({
  emptyState,
  prizes,
}: {
  emptyState: ComingSoonContent;
  prizes: readonly Prize[];
}) {
  if (prizes.length === 0) {
    return <ComingSoonState content={emptyState} icon={Trophy} />;
  }

  return (
    <section aria-labelledby="prizes-heading" className="space-y-4">
      <h2
        id="prizes-heading"
        className="font-red-hat text-3xl font-bold text-ink sm:text-4xl"
      >
        Prizes
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {prizes.map((prize) => (
          <article
            key={prize.id}
            className={cn(LIQUID_GLASS_CARD_CLASS, "rounded-md p-5")}
          >
            {prize.sponsor ? (
              <p className="font-red-hat text-xs font-semibold uppercase tracking-[0.16em] text-olive">
                {prize.sponsor}
              </p>
            ) : null}
            <h3 className="font-red-hat mt-1 text-lg font-semibold text-ink">
              {prize.title}
            </h3>
            {prize.value ? (
              <p className="font-red-hat mt-1 text-sm font-semibold text-olive">
                {prize.value}
              </p>
            ) : null}
            <p className="font-red-hat mt-2 text-sm leading-6 text-ink/75">
              {prize.description}
            </p>
            {prize.eligibility ? (
              <p className="font-red-hat mt-3 text-xs leading-5 text-ink/70">
                <span className="font-semibold text-ink">Eligibility:</span>{" "}
                {prize.eligibility}
              </p>
            ) : null}
            {prize.judgingCriteria ? (
              <p className="font-red-hat mt-2 text-xs leading-5 text-ink/70">
                <span className="font-semibold text-ink">Judging:</span>{" "}
                {prize.judgingCriteria}
              </p>
            ) : null}
            {prize.href ? (
              <a
                href={prize.href}
                target="_blank"
                rel="noreferrer"
                className="font-red-hat mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-olive hover:text-moss"
              >
                View details
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

type LiveView = "timeline" | "guide" | "prizes";

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
        "flex gap-3 overflow-x-auto [scrollbar-width:none] sm:gap-10 [&::-webkit-scrollbar]:hidden",
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
                ? "h-12 text-[11px] tracking-[0.08em] sm:h-14 sm:text-base sm:tracking-[0.14em]"
                : "h-11 gap-1.5 text-[11px] tracking-[0.08em] sm:h-12 sm:gap-2 sm:text-sm sm:tracking-[0.14em]",
              isActive ? "text-olive" : "text-ink/70 hover:text-ink",
            )}
            role="tab"
          >
            <Icon className="size-3.5 sm:size-4" />
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

function toCalendarTimestamp(iso: string) {
  return new Date(iso)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/u, "Z");
}

function getCalendarUrl(event: LiveEvent) {
  const start = new Date(event.startsAt);
  const fallbackEnd = new Date(start.getTime() + 60 * 60 * 1_000);
  const end = event.endsAt ? new Date(event.endsAt) : fallbackEnd;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.name,
    dates: `${toCalendarTimestamp(start.toISOString())}/${toCalendarTimestamp(end.toISOString())}`,
    details: event.description,
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getLocationUrl(event: LiveEvent) {
  if (event.mapUrl) return event.mapUrl;
  if (event.location.toLowerCase() === "devpost") return null;

  const query = encodeURIComponent(`${event.location}, Ann Arbor, MI`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function EventCard({
  event,
  now,
  onSelect,
  timezone,
}: {
  event: LiveEvent;
  now: number | null;
  onSelect: (event: LiveEvent) => void;
  timezone: string;
}) {
  const status = getEventStatus(event, now);
  const formatter = timeFormatter(timezone);

  return (
    <button
      id={`event-${event.slug}`}
      type="button"
      onClick={() => onSelect(event)}
      className={cn(
        "liquid-glass-card group relative w-full scroll-mt-28 cursor-pointer overflow-hidden rounded-md text-left hover:-translate-y-0.5 sm:grid sm:grid-cols-[11rem_1fr_auto] sm:items-center sm:gap-6",
        status === "Past" && "opacity-55",
      )}
    >
      <div className="relative z-10 flex items-baseline gap-2 p-5 sm:flex-col sm:items-start sm:gap-1 sm:p-6 sm:pr-0">
        <p className="font-red-hat text-2xl leading-none text-olive sm:text-3xl">
          {formatter.format(new Date(event.startsAt))}
        </p>
        {event.endsAt ? (
          <p className="font-red-hat text-xs text-ink/70">
            until {formatter.format(new Date(event.endsAt))}
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
        <span className="font-red-hat inline-flex h-10 w-10 items-center justify-center rounded-md border border-olive/15 bg-white/40 text-olive transition-all duration-300 group-hover:border-olive/30 group-hover:bg-white/70">
          <ChevronRight className="size-4" />
        </span>
      </div>
    </button>
  );
}

function EventDetailsDrawer({
  event,
  now,
  onOpenChange,
  open,
  timezone,
}: {
  event: LiveEvent | null;
  now: number | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  timezone: string;
}) {
  if (!event) return null;

  const status = getEventStatus(event, now);
  const locationUrl = getLocationUrl(event);

  const shareEvent = async () => {
    const url = new URL(window.location.href);
    url.hash = `event-${event.slug}`;
    const shareData = {
      title: `${event.name} | MHacks Live`,
      text: `${event.name} at ${formatEventTime(event, timezone)}`,
      url: url.toString(),
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareData.url);
      toast.success("Event link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this event");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          LIQUID_GLASS_PANEL_CLASS,
          "!fixed overflow-y-auto rounded-t-2xl border-olive/10 text-ink",
        )}
      >
        <Button
          aria-label="Close event details"
          className="absolute top-4 right-4 z-10 rounded-md text-ink/65 hover:bg-sage/30 hover:text-ink"
          onClick={() => onOpenChange(false)}
          size="icon-sm"
          variant="ghost"
        >
          <X />
        </Button>
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
              {formatEventTime(event, timezone)} · {event.location}
            </DrawerDescription>
          </DrawerHeader>

          <div className="font-red-hat space-y-4 px-4 pb-2 text-sm text-ink/75">
            {event.summary ? (
              <p className="text-base font-medium leading-6 text-ink">
                {event.summary}
              </p>
            ) : null}
            <p className="whitespace-pre-line leading-6">{event.description}</p>
            <div className="grid gap-px overflow-hidden rounded-md border border-olive/10 bg-olive/5 sm:grid-cols-2">
              <div className="bg-white/50 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink/70">
                  Time
                </div>
                <div className="font-red-hat mt-1 font-medium text-ink">
                  {formatEventTime(event, timezone)}
                </div>
              </div>
              <div className="bg-white/50 p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink/70">
                  Location
                </div>
                <div className="font-red-hat mt-1 font-medium text-ink">
                  {event.location}
                </div>
                {event.locationDetails ? (
                  <div className="mt-1 text-xs leading-5 text-ink/65">
                    {event.locationDetails}
                  </div>
                ) : null}
              </div>
              {event.hostName ? (
                <div className="bg-white/50 p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-ink/70">
                    Host
                  </div>
                  <div className="font-red-hat mt-1 font-medium text-ink">
                    {event.hostName}
                  </div>
                </div>
              ) : null}
              {event.audience || event.capacity ? (
                <div className="bg-white/50 p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-ink/70">
                    Attendees
                  </div>
                  <div className="font-red-hat mt-1 font-medium text-ink">
                    {[
                      event.audience,
                      event.capacity ? `${event.capacity} spots` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              ) : null}
            </div>

            <section
              aria-labelledby="event-actions-heading"
              className="rounded-md border border-olive/12 bg-white/45 p-4"
            >
              <h3
                id="event-actions-heading"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-olive"
              >
                Event actions
              </h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button
                  asChild
                  variant="outline"
                  className="h-auto justify-between rounded-md border-olive/20 bg-white/55 px-3 py-2.5 text-olive hover:bg-white/85"
                >
                  <a
                    href={getCalendarUrl(event)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CalendarPlus className="size-4" />
                      Add to calendar
                    </span>
                    <ExternalLink className="size-3.5 opacity-60" />
                  </a>
                </Button>

                {locationUrl ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-auto justify-between rounded-md border-olive/20 bg-white/55 px-3 py-2.5 text-olive hover:bg-white/85"
                  >
                    <a href={locationUrl} target="_blank" rel="noreferrer">
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="size-4" />
                        Open location
                      </span>
                      <ExternalLink className="size-3.5 opacity-60" />
                    </a>
                  </Button>
                ) : null}

                {event.resources.map((resource) =>
                  resource.href ? (
                    <Button
                      key={`${resource.kind}-${resource.label}`}
                      asChild
                      variant="outline"
                      className="h-auto justify-between rounded-md border-olive/20 bg-white/55 px-3 py-2.5 text-olive hover:bg-white/85"
                    >
                      <a href={resource.href} target="_blank" rel="noreferrer">
                        <span>{resource.label}</span>
                        <ExternalLink className="size-3.5 opacity-60" />
                      </a>
                    </Button>
                  ) : (
                    <Button
                      key={`${resource.kind}-${resource.label}`}
                      type="button"
                      variant="outline"
                      disabled
                      className="h-auto justify-between rounded-md border-olive/15 bg-white/35 px-3 py-2.5 text-ink/55"
                    >
                      <span>{resource.label}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        Coming soon
                      </span>
                    </Button>
                  ),
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={shareEvent}
                  className="h-auto justify-start rounded-md border-olive/20 bg-white/55 px-3 py-2.5 text-olive hover:bg-white/85"
                >
                  <Share2 className="size-4" />
                  Share event
                </Button>
              </div>
            </section>
          </div>

          <DrawerFooter className="sm:flex-row sm:justify-end">
            <Button
              className="rounded-md bg-olive text-cream hover:bg-moss"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function LiveEvents({
  announcements,
  events,
  guideLinks,
  prizes,
  settings,
}: LiveEventsProps) {
  const [activeView, setActiveView] = useState<LiveView>("timeline");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showPast, setShowPast] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
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

  const days = useMemo(
    () => groupEvents(visibleEvents, settings.timezone),
    [settings.timezone, visibleEvents],
  );
  const allDays = useMemo(
    () => groupEvents(events, settings.timezone),
    [events, settings.timezone],
  );
  const eventsById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events],
  );
  const eventsBySlug = useMemo(
    () => new Map(events.map((event) => [event.slug, event])),
    [events],
  );

  const [activeDay, setActiveDay] = useState(days[0]?.key ?? "");

  useEffect(() => {
    const syncEventFromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash.startsWith("event-")) {
        setEventDrawerOpen(false);
        return;
      }

      const event = eventsBySlug.get(hash.slice("event-".length));
      if (!event) return;

      setActiveView("timeline");
      setActiveDay(dayKey(event.startsAt, settings.timezone));
      setShowPast(true);
      setSelectedEventId(event.id);
      setEventDrawerOpen(true);
    };

    syncEventFromHash();
    window.addEventListener("hashchange", syncEventFromHash);
    return () => window.removeEventListener("hashchange", syncEventFromHash);
  }, [eventsBySlug, settings.timezone]);

  const openEvent = useCallback((event: LiveEvent) => {
    setSelectedEventId(event.id);
    setEventDrawerOpen(true);
    const url = new URL(window.location.href);
    url.hash = `event-${event.slug}`;
    window.history.replaceState(null, "", url);
  }, []);

  const handleEventDrawerOpenChange = useCallback((open: boolean) => {
    setEventDrawerOpen(open);
    if (open) return;

    const url = new URL(window.location.href);
    if (url.hash.startsWith("#event-")) {
      url.hash = "";
      window.history.replaceState(null, "", url);
    }
  }, []);

  const currentDay = days.find((day) => day.key === activeDay) ?? days[0];
  const currentDayEvents = currentDay?.events.filter(matchesCategory) ?? [];
  const pastCount = events.length - visibleEvents.length;
  const scheduleRange = formatScheduleRange(events, settings.timezone);
  const showFloatingNav = tabsPassed && scrollNavVisible;
  const selectedEvent = selectedEventId
    ? (eventsById.get(selectedEventId) ?? null)
    : null;

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
              {settings.eventName}
            </span>
            <h1 className="font-red-hat mt-5 text-5xl font-black uppercase leading-[0.95] tracking-tight text-cream drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:text-7xl">
              {settings.heroTitle}
            </h1>
            <p className="font-red-hat mt-3 max-w-xl text-lg font-medium leading-7 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-xl">
              {settings.heroDescription}
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
          <QuickLinks devpostUrl={settings.devpostUrl} />
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
                      Times shown in {settings.timezone}. Schedule subject to
                      change.
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
                          <EventCard
                            key={event.id}
                            event={event}
                            now={now}
                            onSelect={openEvent}
                            timezone={settings.timezone}
                          />
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
                          <EventCard
                            key={event.id}
                            event={event}
                            now={now}
                            onSelect={openEvent}
                            timezone={settings.timezone}
                          />
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

              <Announcements items={announcements} />
            </motion.div>
          ) : activeView === "guide" ? (
            <motion.div
              id="guide-panel"
              role="tabpanel"
              aria-labelledby="guide-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <GuidePanel
                emptyState={{
                  eyebrow: "Hacker guide",
                  title: settings.guideEmptyTitle,
                  description: settings.guideEmptyDescription,
                }}
                links={guideLinks}
              />
            </motion.div>
          ) : (
            <motion.div
              id="prizes-panel"
              role="tabpanel"
              aria-labelledby="prizes-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <PrizesPanel
                emptyState={{
                  eyebrow: "Prizes",
                  title: settings.prizesEmptyTitle,
                  description: settings.prizesEmptyDescription,
                }}
                prizes={prizes}
              />
            </motion.div>
          )}
        </div>
      </section>

      <EventDetailsDrawer
        event={selectedEvent}
        now={now}
        open={eventDrawerOpen}
        onOpenChange={handleEventDrawerOpenChange}
        timezone={settings.timezone}
      />
    </main>
  );
}
