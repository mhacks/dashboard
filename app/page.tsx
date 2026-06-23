import Image from "next/image";
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

export default function Home() {
  return (
    <div style={{ overflowX: "clip" }}>
      <AsciiBackground />
      {/* ── Navbar ── */}
      <NavBar />

      {/* ── Hero ── */}
      <HeroSection />

      {/* ── Stats band ── */}
      <div
        className="relative flex h-[80px] sm:h-[100px] lg:h-[124px] items-center justify-center overflow-hidden"
        style={{
          borderTop: "1px solid white",
          borderBottom: "1px solid white",
          backgroundColor: "rgba(238,235,223,0.2)",
        }}
      >
        <div
          className="flex gap-6 sm:gap-10 lg:gap-[50px] italic items-center whitespace-nowrap"
          style={{
            color: "#445721",
            fontSize: "clamp(20px, 4vw, 48px)",
            lineHeight: "1.1",
            fontFamily: "var(--font-red-hat-display), sans-serif",
          }}
        >
          <span>1000+ Hackers</span>
          <span>•</span>
          <span>$40k+ in prizes</span>
          <span>•</span>
          <span>350+ Projects</span>
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: "inset 0px 4px 16.2px 23px rgba(255,255,255,0.73)" }}
        />
      </div>

      <AboutSection />
      <StatsBand />

      {/* ── Pixel flower icons ── */}
      <div
        className="hidden md:flex justify-center gap-16 lg:gap-[144px] py-12 lg:py-16"
        style={{ backgroundColor: "#f4f2e8" }}
      >
        <Image src="/pixel_flowers_green.svg" alt="" width={138} height={133} className="[image-rendering:pixelated]" />
        <Image src="/pixel_flowers_blue.svg" alt="" width={138} height={133} className="[image-rendering:pixelated]" />
        <Image src="/pixel_flowers_green.svg" alt="" width={138} height={133} className="[image-rendering:pixelated]" />
        <Image src="/pixel_flowers_blue.svg" alt="" width={138} height={133} className="[image-rendering:pixelated]" />
      </div>

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
