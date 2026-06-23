"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useApplicationsOpen } from "./use-applications-open";

const COORDS = "42.2911672°N 83.7182928°W · Ann Arbor, MI";

const COLUMNS: {
  title: string;
  links: { label: string; href: string; muted?: boolean }[];
}[] = [
  {
    title: "Get involved",
    links: [
      { label: "Apply", href: "/apply" },
      { label: "Contact", href: "mailto:hackathon@mhacks.org" },
      { label: "Become a sponsor", href: "mailto:sponsorship@mhacks.org" },
    ],
  },
];

function useNow() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const initialId = window.setTimeout(updateNow, 0);
    const intervalId = window.setInterval(updateNow, 1000);

    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(intervalId);
    };
  }, []);

  return now;
}

function AnnArborClock() {
  const now = useNow();
  const time = now
    ? new Date(now).toLocaleTimeString("en-US", {
        timeZone: "America/Detroit",
        hour12: false,
      })
    : "--:--:--";
  return <span className="tabular-nums">Ann Arbor — {time}</span>;
}

export default function SiteFooter() {
  const applicationsOpen = useApplicationsOpen();

  return (
    <footer className="border-t border-ink/10 bg-haze font-red-hat">
      <div className="mx-auto max-w-6xl px-8 pb-8 pt-16 sm:px-12 md:px-16 lg:px-24">
        <div className="flex flex-wrap items-start justify-between gap-12">
          {/* Brand */}
          <div className="max-w-xs">
            <Image
              src="/footer_logo.svg"
              alt="MHacks"
              width={577}
              height={145}
              className="h-8 w-auto"
            />
            <p
              className="mt-4 text-xl italic"
              style={{ color: "rgba(58,74,38,0.75)" }}
            >
              Build something that grows.
            </p>
            <p
              className="mt-3 text-[10px] uppercase tracking-[0.2em]"
              style={{ color: "rgba(58,74,38,0.5)" }}
            >
              {COORDS}
            </p>
          </div>

          {/* Link columns */}
          <div className="flex flex-wrap gap-12">
            {COLUMNS.map((col) => (
              <div key={col.title} className="min-w-44">
                <p
                  className="text-[10px] uppercase tracking-[0.25em]"
                  style={{ color: "rgba(58,74,38,0.55)" }}
                >
                  {col.title}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={
                          l.label === "Apply" && !applicationsOpen
                            ? "#"
                            : l.href
                        }
                        aria-disabled={l.label === "Apply" && !applicationsOpen}
                        className={`text-sm font-light transition-colors ${
                          l.muted || (l.label === "Apply" && !applicationsOpen)
                            ? "cursor-not-allowed opacity-50"
                            : ""
                        }`}
                        style={{
                          color:
                            l.muted ||
                            (l.label === "Apply" && !applicationsOpen)
                              ? "rgba(58,74,38,0.35)"
                              : "rgba(58,74,38,0.7)",
                        }}
                        onClick={(e) => {
                          if (l.label === "Apply" && !applicationsOpen) {
                            e.preventDefault();
                          }
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color =
                            l.muted ||
                            (l.label === "Apply" && !applicationsOpen)
                              ? "rgba(58,74,38,0.35)"
                              : "#3A4A26")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color =
                            l.muted ||
                            (l.label === "Apply" && !applicationsOpen)
                              ? "rgba(58,74,38,0.35)"
                              : "rgba(58,74,38,0.7)")
                        }
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t pt-6 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{
            borderColor: "rgba(58,74,38,0.1)",
            color: "rgba(58,74,38,0.55)",
          }}
        >
          <span>© 2026 MHacks, University of Michigan</span>
          <AnnArborClock />
          <span className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: "#5d8a2f",
                animation: "pulse-dot 2s ease-in-out infinite",
              }}
            />
            Applications open Jun 22
          </span>
        </div>
      </div>
    </footer>
  );
}
