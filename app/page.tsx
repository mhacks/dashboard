import Image from "next/image";
import HeroSection from "@/components/hero-section";
import NavBar from "@/components/navbar";
import AsciiBackground from "@/components/ascii-background";
import VideoSpotlight from "@/components/video-spotlight";
import StatsBand from "@/components/stats-band";
import KeyDates from "@/components/key-dates";
import SponsorsSection from "@/components/sponsors-section";
import FaqSection from "@/components/faq-section";
import CtaSection from "@/components/cta-section";
import SiteFooter from "@/components/site-footer";

const ribbonItems = [
  "$40k+ In Prizes",
  "800+ Hackers",
  "24 Hours",
  "October 3 - 4, 2026",
  "Ann Arbor, MI",
];

export default function Home() {
  return (
    <div style={{ overflowX: "clip" }}>
      <AsciiBackground />
      {/* ── Navbar ── */}
      <NavBar />

      {/* ── Hero ── */}
      <HeroSection />

      {/* ── Scrolling ribbon ── */}
      <div
        className="border-b overflow-hidden py-5"
        style={{ borderColor: "#44572155", backgroundColor: "#efe9d4" }}
      >
        <div className="flex animate-scroll-left">
          {[...ribbonItems, ...ribbonItems].map((item, i) => (
            <div key={i} className="flex items-center shrink-0">
              <p
                className="font-red-hat italic text-2xl sm:text-4xl whitespace-nowrap px-8 sm:px-14"
                style={{ color: "#445721" }}
              >
                {item}
              </p>
              <span
                className="font-heading not-italic text-sm sm:text-base shrink-0"
                style={{ color: "#445721" }}
              >
                ◆
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── About ── */}
      <section
        id="about"
        className="scroll-mt-20 relative"
        style={{ backgroundColor: "rgba(244, 242, 232, 0.55)" }}
      >
        <div className="relative flex flex-col items-center px-8 sm:px-12 lg:px-16 pt-16 lg:pt-24 pb-16">
          <h2
            className="flex items-center justify-center gap-4 text-5xl sm:text-6xl leading-tight tracking-tight text-center"
            style={{ color: "#3A4A26" }}
          >
            <Image
              src="/green_logo.png"
              alt=""
              width={40}
              height={40}
              className="h-8 w-8 sm:h-10 sm:w-10"
            />
            <span className="font-sans font-semibold">About MHacks</span>
          </h2>
          <p
            className="font-red-hat mt-6 max-w-xl text-[24px] leading-9 text-center"
            style={{ color: "rgba(58,74,38,0.65)" }}
          >
            MHacks is the University of Michigan&apos;s flagship hackathon,
            bringing together the brightest student minds from across the
            country. Over 24 hours, you&apos;ll collaborate, create, and compete
            for over $40,000 in prizes.
          </p>
          <p
            className="font-red-hat mt-4 max-w-xl text-[24px] leading-9 text-center"
            style={{ color: "rgba(58,74,38,0.65)" }}
          >
            Whether you&apos;re a seasoned hacker or attending your very first
            hackathon, MHacks is the place to turn your wildest ideas into
            reality. Join us for a weekend of innovation, mentorship, and
            community.
          </p>
        </div>
      </section>

      {/* ── Stats / Photo carousel ── */}
      <StatsBand />

      {/* ── MHacks 2025 Recap Video ── */}
      <VideoSpotlight />

      {/* ── Timeline ── */}
      <KeyDates />

      {/* ── Sponsors ── */}
      <SponsorsSection />

      {/* ── FAQs ── */}
      <FaqSection />

      {/* ── CTA ── */}
      <CtaSection />

      {/* ── Footer ── */}
      <SiteFooter />
    </div>
  );
}
