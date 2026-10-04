"use client";

import { CheckCircle2Icon, KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { generateHuntCode } from "@/lib/actions/hunt-codes.server.actions";
import { EVENT_TIME_ZONE } from "@/lib/organizer-locations/display";
import type { IssuedHuntCode, IssuedHuntCodes } from "@/lib/queries/hunt";

/** While a code is waiting to be used, check every few seconds for its use. */
const POLL_MS = 4_000;

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: EVENT_TIME_ZONE,
});

type Status = "open" | "used" | "expired";

function statusOf(code: IssuedHuntCode, now: number): Status {
  if (code.redeemedAt) return "used";
  return Date.parse(code.expiresAt) > now ? "open" : "expired";
}

/** "123 456": easier to read aloud and to type. */
function spaced(code: string) {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function countdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The server's clock as seen from here, ticking every second. Countdowns run
 * off the server's read time, so a wrong laptop clock can't shorten them.
 */
function useServerNow(readAt: string) {
  const [elapsed, setElapsed] = useState({ readAt, ms: 0 });

  useEffect(() => {
    const receivedAt = Date.now();
    const id = window.setInterval(
      () => setElapsed({ readAt, ms: Date.now() - receivedAt }),
      1_000,
    );
    return () => window.clearInterval(id);
  }, [readAt]);

  // A fresh read restarts the count from its own server time.
  return Date.parse(readAt) + (elapsed.readAt === readAt ? elapsed.ms : 0);
}

export function HuntCodePanel({ issued }: { issued: IssuedHuntCodes }) {
  const router = useRouter();
  const now = useServerNow(issued.readAt);
  const [generating, startGenerating] = useTransition();

  const statuses = issued.codes.map((code) => statusOf(code, now));
  const waiting = statuses.includes("open");
  const latest = issued.codes[0];
  const latestStatus = statuses[0];

  // Picks up a hacker using a code without the organizer touching anything.
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => router.refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [waiting, router]);

  function generate() {
    startGenerating(async () => {
      const result = await generateHuntCode();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Your code</CardTitle>
          <CardDescription>
            Read it out or show your screen. The hacker enters it on Find my
            organizer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-5">
          {latest && latestStatus === "open" ? (
            <div aria-live="polite">
              <p className="font-red-hat-mono text-6xl font-semibold tracking-[0.12em] tabular-nums">
                {spaced(latest.code)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Expires in{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {countdown(Date.parse(latest.expiresAt) - now)}
                </span>
              </p>
            </div>
          ) : latest && latestStatus === "used" ? (
            <p
              className="flex items-center gap-2 text-base font-medium"
              aria-live="polite"
            >
              <CheckCircle2Icon className="size-5" aria-hidden />
              Used at {timeFormat.format(new Date(latest.redeemedAt!))}. Make a
              new one for the next hacker.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No code open right now.
            </p>
          )}

          <Button onClick={generate} disabled={generating} size="lg">
            {generating ? (
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
            ) : (
              <KeyRoundIcon className="size-4" aria-hidden />
            )}
            {latestStatus === "open" ? "Make another code" : "Make a code"}
          </Button>
          {latestStatus === "open" ? (
            <p className="-mt-2 text-xs text-muted-foreground">
              Making another doesn&apos;t cancel this one, so you can hand out
              codes to a line.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {issued.codes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent codes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {issued.codes.map((code, index) => (
                <li
                  key={code.id}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <span className="font-red-hat-mono tabular-nums">
                    {spaced(code.code)}
                  </span>
                  <span className="text-muted-foreground">
                    Made {timeFormat.format(new Date(code.createdAt))}
                  </span>
                  {statuses[index] === "used" ? (
                    <Badge>
                      Used {timeFormat.format(new Date(code.redeemedAt!))}
                    </Badge>
                  ) : statuses[index] === "open" ? (
                    <Badge variant="outline">Waiting</Badge>
                  ) : (
                    <Badge variant="secondary">Expired</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
