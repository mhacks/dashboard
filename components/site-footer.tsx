"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useApplicationsOpen } from "./use-applications-open";

const COORDS = "42.2780°N / 83.7382°W";

const COLUMNS: {
  title: string;
  links: { label: string; href: string; muted?: boolean }[];
}[] = [
  {
    title: "Event",
    links: [
      { label: "About", href: "/about" },
      { label: "Tracks", href: "/tracks" },
      { label: "Key dates", href: "/key-dates" },
    ],
  },
  {
    title: "Attend",
    links: [
      { label: "Apply", href: "/apply" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "mailto:hackathon@mhacks.org" },
    ],
  },
  {
    title: "Sponsor",
    links: [
      { label: "Become a sponsor", href: "mailto:sponsorship@mhacks.org" },
      { label: "Sponsors", href: "/sponsors" },
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
    <footer
      className="font-red-hat"
      style={{
        background: "linear-gradient(180deg, #D2F4FE 0%, #F4F2E8 125.88%)",
        borderTop: "1px solid rgba(31, 42, 22, 0.1)",
        boxShadow: "inset 0px 4px 10px #A4D7F7",
      }}
    >
      <div className="mx-auto max-w-6xl px-8 pb-8 pt-16 sm:px-12 md:px-16 lg:px-24">
        <div className="relative flex flex-wrap items-start justify-between gap-12">
          {/* Brand */}
          <div className="max-w-xs">
            <Image
              src="/mhacks_logo_2.png"
              alt="MHacks"
              width={577}
              height={145}
              className="h-8 w-auto"
            />
            <p
              className="mt-4"
              style={{
                color: "rgba(58,74,38,0.75)",
                fontFamily: "Red Hat Display",
                fontWeight: 700,
                fontStyle: "normal",
                fontSize: "20px",
                lineHeight: "28px",
                letterSpacing: "0px",
              }}
            >
              Build something that grows.
            </p>
            <p
              className="mt-3"
              style={{
                color: "rgba(58,74,38,0.5)",
                fontFamily: "Red Hat Display",
                fontWeight: 400,
                fontStyle: "normal",
                fontSize: "10px",
                lineHeight: "15px",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              {COORDS}
            </p>
            <pre
              className="mt-6 select-none"
              style={{
                fontFamily: "Red Hat Mono, monospace",
                fontWeight: 500,
                fontSize: "8px",
                lineHeight: "normal",
                letterSpacing: "-1.5px",
                color: "rgba(58,74,38,0.4)",
                whiteSpace: "pre",
              }}
            >
              {`     _    (_)  )Y(  _   (_)   )Y(    _\n    (o)    w   '|' (@)   w    '|'   (o)\n     |   . | .  |   |    |   . | .   |\n___(\|/)_)\|/(_d|b_q|p_(\|/)_)\|/(_(\|/)__`}
            </pre>
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
                        className={`transition-colors ${
                          l.muted || (l.label === "Apply" && !applicationsOpen)
                            ? "cursor-not-allowed opacity-50"
                            : ""
                        }`}
                        style={{
                          fontFamily: "Red Hat Display",
                          fontWeight: 300,
                          fontSize: "14px",
                          lineHeight: "20px",
                          letterSpacing: "0px",
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
          className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-[10px] uppercase tracking-[0.18em]"
          style={{
            borderColor: "rgba(58,74,38,0.1)",
            color: "rgba(58,74,38,0.55)",
            fontFamily: "Red Hat Display",
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
