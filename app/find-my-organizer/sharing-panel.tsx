"use client";

import { CopyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Caret, buttonClass } from "@/components/console/button";
import { Panel, PanelHeading } from "@/components/console/panel";
import {
  type SharingSetup,
  startSharingLocation,
  stopSharingLocation,
} from "@/lib/actions/organizer-locations.server.actions";
import { QR_QUIET_ZONE, qrPath } from "@/lib/checkin/qr";
import {
  PUBLIC_WINDOW_MINUTES,
  TRAIL_HOURS,
} from "@/lib/organizer-locations/display";
import type { MySharing } from "@/lib/queries/organizer-locations";

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

function SetupQr({ value }: { value: string }) {
  const { size, path } = useMemo(() => qrPath(value, "L"), [value]);
  const box = size + QR_QUIET_ZONE * 2;
  return (
    <svg
      viewBox={`${-QR_QUIET_ZONE} ${-QR_QUIET_ZONE} ${box} ${box}`}
      role="img"
      aria-label="QR code that opens the OwnTracks setup link"
      className="size-44 shrink-0 bg-white"
      shapeRendering="crispEdges"
    >
      <path d={path} fill="#17171a" />
    </svg>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-red-hat-mono text-[11px] tracking-[0.18em] text-ui-ink-soft">
        {label.toUpperCase()}
      </span>
      <div className="flex min-w-0 items-center gap-2 border border-ui-line bg-ui-well px-2.5 py-1.5">
        <code className="min-w-0 flex-1 truncate font-red-hat-mono text-xs text-ui-ink">
          {value}
        </code>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard
              .writeText(value)
              .then(() => toast.success(`${label} copied`))
              .catch(() => toast.error("Couldn't copy. Select it instead."))
          }
          aria-label={`Copy ${label.toLowerCase()}`}
          className="shrink-0 text-ui-ink-soft hover:text-ui-ink"
        >
          <CopyIcon className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function SetupSteps({ setup }: { setup: SharingSetup }) {
  return (
    <div className="flex flex-col gap-4 border border-ui-line-strong p-4">
      <p className="text-sm leading-[1.55] text-ui-ink">
        Shown once. If you lose it, make a new link; the old password stops
        working.
      </p>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <SetupQr value={setup.configLink} />
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-[1.55] text-ui-ink">
          <li>
            Install <strong>OwnTracks</strong> from the App Store or Google
            Play.
          </li>
          <li>
            Scan this code with your phone&apos;s camera, or open this page on
            your phone and tap the button below. OwnTracks opens and fills in
            every setting.
          </li>
          <li>
            Allow location access <strong>Always</strong>, so it keeps reporting
            with the phone locked.
          </li>
          <li>
            On shift, switch OwnTracks to <strong>Move</strong>
            {
              " mode for frequent updates. It uses more battery; the default only reports after you've moved a fair distance."
            }
          </li>
        </ol>
      </div>
      <a href={setup.configLink} className={buttonClass("primary", "w-fit")}>
        <Caret /> Open in OwnTracks
      </a>
      <details className="text-sm text-ui-ink-soft">
        <summary className="cursor-pointer">Set it up by hand instead</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <CopyField label="Mode" value="HTTP" />
          <CopyField label="URL" value={setup.url} />
          <CopyField label="Username" value={setup.username} />
          <CopyField label="Password" value={setup.password} />
        </div>
      </details>
    </div>
  );
}

export function SharingPanel({ sharing }: { sharing: MySharing | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(sharing?.displayName ?? "");
  const [setup, setSetup] = useState<SharingSetup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = () =>
    startTransition(async () => {
      setError(null);
      const result = await startSharingLocation(displayName);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSetup(result.data);
      router.refresh();
    });

  const stop = () => {
    if (
      !window.confirm(
        "Stop sharing? Your password stops working and every location you've sent is deleted.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      await stopSharingLocation();
      setSetup(null);
      toast.success("Stopped sharing. Your locations were deleted.");
      router.refresh();
    });
  };

  return (
    <Panel eyebrow="YOUR LOCATION" status={sharing ? "Sharing" : "Not sharing"}>
      <PanelHeading
        lede={`Checked-in hackers see your name and position while it's under ${PUBLIC_WINDOW_MINUTES} minutes old — no trail, no battery. Organizers also see your last ${TRAIL_HOURS} hours. Stopping deletes everything you've sent.`}
      >
        {sharing ? "You're on the map" : "Share your location"}
      </PanelHeading>

      {sharing ? (
        <p className="text-sm text-ui-ink">
          Sharing as <strong>{sharing.displayName}</strong>.{" "}
          {sharing.lastFixAt
            ? `Last update ${dateTimeFormat.format(new Date(sharing.lastFixAt))}.`
            : "No update from your phone yet — finish the setup below."}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-red-hat-mono text-[11px] tracking-[0.18em] text-ui-ink-soft">
            NAME HACKERS SEE
          </span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={40}
            placeholder="e.g. Alex (Logistics)"
            className="border border-ui-line-strong bg-ui-paper px-3 py-2.5 text-sm text-ui-ink outline-none focus-visible:border-ui-ink"
          />
        </label>
        <button
          type="button"
          onClick={start}
          disabled={pending}
          className={buttonClass(
            sharing ? "outline" : "primary",
            "disabled:opacity-60",
          )}
        >
          {sharing ? (
            "Rename and make a new setup link"
          ) : (
            <>
              <Caret /> Start sharing
            </>
          )}
        </button>
        {sharing ? (
          <button
            type="button"
            onClick={stop}
            disabled={pending}
            className={buttonClass("secondary", "disabled:opacity-60")}
          >
            Stop sharing
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-ui-ink">
          {error}
        </p>
      ) : null}

      {setup ? <SetupSteps setup={setup} /> : null}
    </Panel>
  );
}
