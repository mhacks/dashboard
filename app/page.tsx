import HeroSection from "@/components/hero-section";
import NavBar from "@/components/navbar";
import AsciiBackground from "@/components/ascii-background";
import AboutSection from "@/components/about-section";
import VideoSpotlight from "@/components/video-spotlight";
import StatsBand from "@/components/stats-band";
import KeyDates from "@/components/key-dates";
import SponsorsSection from "@/components/sponsors-section";
import FaqSection from "@/components/faq-section";
import SiteFooter from "@/components/site-footer";
import GradientBlobs from "@/components/gradient-blobs";

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

      {/* ── About + gradient blobs ── */}
      <div className="relative">
        <GradientBlobs />
        <AboutSection />
      </div>
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
      {/* <CtaSection /> */}

      {/* ── Footer ── */}
      <SiteFooter />
    </div>
  );
}
