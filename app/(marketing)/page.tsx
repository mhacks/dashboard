import { About } from "@/components/landing/sections/About";
import { Agent } from "@/components/landing/sections/Agent";
import { Faq } from "@/components/landing/sections/Faq";
import { Footer } from "@/components/landing/sections/Footer";
import { Hero } from "@/components/landing/sections/Hero";
import { Schedule } from "@/components/landing/sections/Schedule";
import { Sponsors } from "@/components/landing/sections/Sponsors";
import { StackedPages } from "@/components/landing/StackedPages";

export default function Home() {
  return (
    <main className="relative bg-moss-900">
      <Hero />
      <About />
      <Sponsors />
      <Schedule />
      <Agent />
      <Faq />
      <Footer />
      <StackedPages />
    </main>
  );
}
