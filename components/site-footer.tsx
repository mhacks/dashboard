"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const COORDS = "42°17′N 83°43′W · Ann Arbor, MI";

const COLUMNS = [
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
  return (
    <footer className="border-t border-ink/10 bg-haze">
      <div className="mx-auto max-w-6xl px-5 pb-8 pt-16 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-12">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-1">
              <Image
                src="/green_logo.png"
                alt="M"
                width={36}
                height={36}
                className="h-[1.7em] w-[1.7em] opacity-80"
              />
              <span
                className="font-sans text-2xl font-semibold leading-none"
                style={{ color: "#3A4A26" }}
              >
                Hacks
              </span>
            </div>
            <p
              className="font-red-hat mt-4 text-xl italic"
              style={{ color: "rgba(58,74,38,0.75)" }}
            >
              Build something that grows.
            </p>
            <p
              className="font-red-hat mt-3 text-[10px] uppercase tracking-[0.2em]"
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
                  className="font-red-hat text-[10px] uppercase tracking-[0.25em]"
                  style={{ color: "rgba(58,74,38,0.55)" }}
                >
                  {col.title}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className={`text-sm font-light transition-colors ${
                          l.muted ? "opacity-50" : ""
                        }`}
                        style={{
                          color: l.muted
                            ? "rgba(58,74,38,0.35)"
                            : "rgba(58,74,38,0.7)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = l.muted
                            ? "rgba(58,74,38,0.35)"
                            : "#3A4A26")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = l.muted
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
