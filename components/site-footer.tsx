"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const COORDS = "42.2780°N / 83.7382°W";

const SIGNATURE = String.raw`   ( )  )%(    ( )  )%(
  (o) ※ ˇiˇ (ii) ※ ˇiˇ (o)
   | .|.| |  |   | .|.| |
__(\|/)\|/(.d!b.q|p.)\|/(\|/)__`;

const COLUMNS = [
  {
    title: "Event",
    links: [
      { label: "About", href: "#about" },
      { label: "Tracks", href: "#tracks" },
      { label: "Key dates", href: "#timeline" },
    ],
  },
  {
    title: "Attend",
    links: [
      { label: "Apply", href: "#" },
      { label: "FAQ", href: "#faqs" },
      { label: "Contact", href: "mailto:hackathon-org@umich.edu" },
    ],
  },
  {
    title: "Sponsor",
    links: [
      { label: "Become a sponsor", href: "mailto:sponsorship@mhacks.org" },
      { label: "Sponsors", href: "#sponsors" },
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
    <footer
      className="relative"
      style={{
        background: "linear-gradient(180deg, #d8eef2 0%, #e9f1ec 100%)",
      }}
    >
      <div className="mx-auto max-w-[1240px] px-6 pb-7 pt-14 md:px-12">
        <div className="flex flex-wrap items-start justify-between gap-12">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-1.5">
              <Image
                src="/green_logo.png"
                alt="MHacks logo"
                width={26}
                height={26}
                className="h-[22px] w-auto"
              />
              <span
                className="font-red-hat text-[19px] font-bold tracking-[-0.03em]"
                style={{ color: "#1f2a16" }}
              >
                HACKS
              </span>
            </div>
            <p
              className="mt-5 font-sans text-[22px] font-semibold leading-tight"
              style={{ color: "#1f2a16" }}
            >
              Build something that grows.
            </p>
            <p
              className="font-mono mt-5 text-[11px] tracking-[0.12em]"
              style={{ color: "rgba(58,74,38,0.5)" }}
            >
              {COORDS}
            </p>
            <pre
              className="mt-3 font-mono text-[8px] leading-[1.35]"
              style={{ color: "rgba(58,74,38,0.45)" }}
            >
              {SIGNATURE}
            </pre>
          </div>

          {/* Stickers */}
          <div className="relative hidden min-w-[240px] flex-1 justify-center md:flex">
            <div className="relative h-[150px] w-[240px]">
              <a
                href="#"
                className="absolute left-9 top-0 transition-transform duration-300 hover:-translate-y-0.5"
                style={{ transform: "rotate(-4deg)" }}
              >
                <Image
                  src="/footer-sticker-apply.png"
                  alt="Apply"
                  width={170}
                  height={72}
                  className="w-[150px]"
                />
              </a>
              <a
                href="mailto:sponsorship@mhacks.org"
                className="absolute left-0 top-[78px] transition-transform duration-300 hover:-translate-y-0.5"
                style={{ transform: "rotate(-5deg)" }}
              >
                <Image
                  src="/footer-sticker-sponsor.png"
                  alt="Sponsor"
                  width={180}
                  height={76}
                  className="w-[160px]"
                />
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="flex flex-wrap gap-12 md:gap-14">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p
                  className="font-red-hat text-[11px] uppercase tracking-[0.22em]"
                  style={{ color: "rgba(58,74,38,0.5)" }}
                >
                  {col.title}
                </p>
                <ul className="mt-4 flex flex-col gap-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="font-red-hat text-[15px] transition-colors"
                        style={{ color: "rgba(58,74,38,0.75)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#3A4A26")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "rgba(58,74,38,0.75)")
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
          className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-5 font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{
            borderColor: "rgba(58,74,38,0.15)",
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
