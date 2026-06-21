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

const ribbonItems = ["1000+ Hackers", "$40k+ in prizes", "350+ Projects"];

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
        className="border-y border-white/90 overflow-hidden py-[34px] shadow-[inset_0_4px_16px_23px_rgba(255,255,255,0.73)]"
        style={{ backgroundColor: "rgba(238,235,223,0.2)" }}
      >
        <div className="flex animate-scroll-left">
          {[...ribbonItems, ...ribbonItems].map((item, i) => (
            <div key={i} className="flex items-center shrink-0">
              <p
                className="font-heading italic text-[32px] sm:text-[48px] leading-[1.1] whitespace-nowrap px-8 sm:px-[25px]"
                style={{ color: "#445721" }}
              >
                {item}
              </p>
              <span
                className="font-heading not-italic text-[28px] sm:text-[44px] shrink-0"
                style={{ color: "#445721" }}
              >
                &bull;
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── About ── */}
      <AboutSection />

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

      {/* ── Footer ── */}
      <SiteFooter />
    </div>
  );
}
