import HeroSection from "@/components/hero-section";
import NavBar from "@/components/navbar";
import AsciiBackground from "@/components/ascii-background";
import TracksSection from "@/components/tracks-section";
import VideoSpotlight from "@/components/video-spotlight";
import StatsBand from "@/components/stats-band";
import KeyDates from "@/components/key-dates";
import SponsorsSection from "@/components/sponsors-section";
import FaqSection from "@/components/faq-section";
import CtaSection from "@/components/cta-section";
import SiteFooter from "@/components/site-footer";

const ribbonItems = [
  "$30k+ In Prizes",
  "200+ Projects",
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
      <div className="border-b overflow-hidden py-5" style={{ borderColor: "#44572155", backgroundColor: "#efe9d4" }}>
        <div className="flex animate-scroll-left">
          {[...ribbonItems, ...ribbonItems].map((item, i) => (
            <div key={i} className="flex items-center shrink-0">
              <p
                className="font-heading italic text-2xl sm:text-4xl whitespace-nowrap px-8 sm:px-14"
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
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-center flex items-center gap-2" style={{ color: "rgba(58,74,38,0.5)" }}>
            <span>★</span>
            About MHacks
            <span>★</span>
          </p>
          <h2
            className="text-5xl sm:text-6xl leading-tight tracking-tight text-center"
            style={{ color: "#3A4A26" }}
          >
            <span className="font-sans font-semibold">Calling all</span>{" "}
            <span className="font-heading font-semibold italic" style={{ color: "rgba(58,74,38,0.62)" }}>hackers.</span>
          </h2>
          <p className="mt-6 max-w-xl text-[14px] leading-7 text-center" style={{ color: "rgba(58,74,38,0.65)" }}>
            MHacks is the University of Michigan&apos;s flagship hackathon,
            bringing together the brightest student minds from across the
            country. Over 24 hours, you&apos;ll collaborate, create, and
            compete for over $30,000 in prizes.
          </p>
          <p className="mt-4 max-w-xl text-[14px] leading-7 text-center" style={{ color: "rgba(58,74,38,0.65)" }}>
            Whether you&apos;re a seasoned hacker or attending your very first
            hackathon, MHacks is the place to turn your wildest ideas into
            reality. Join us for a weekend of innovation, mentorship, and
            community.
          </p>

        </div>

        <VideoSpotlight />
        <div className="pb-24" />
      </section>

      {/* ── Tracks ── */}
      <TracksSection />

      {/* ── Stats / Photo carousel ── */}
      <StatsBand />

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
