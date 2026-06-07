import Image from "next/image";
import FaqAccordion from "@/components/faq-accordion";

const tracks = [
  {
    name: "Artificial Intelligence",
    description: "Build systems that sense, reason, and act in the world",
    flower: "/dark_blue_flower.png",
  },
  {
    name: "Sustainability",
    description: "Engineer tech-driven solutions for a resilient planet",
    flower: "/light_blue_flower.png",
  },
  {
    name: "Healthcare",
    description: "Reimagine how people access and receive care",
    flower: "/pink_flower.png",
  },
  {
    name: "Fintech",
    description: "Reshape money, markets, and economic access for all",
    flower: "/yellow_flower.png",
  },
];

const sponsors = {
  diamond: ["AppLovin", "fetch.ai"],
  gold: ["Combinator", "Innovation Labs", "CREO"],
  silver: ["LiveKit", "REKA", "DEN", "glu", "brighte", "VAPI"],
  bronze: ["VISA", "WARP", "Windsurf", "Promise", "Apple", "Snap AR", "Matter"],
};

export default function Home() {
  return (
    <div className="overflow-x-hidden bg-white">
      {/* ── Navbar ── */}
      <nav className="fixed top-4 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-8 rounded-full border border-white/20 bg-white/[0.08] px-5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
          <Image
            src="/mhacks_logo.png"
            alt="MHacks"
            width={28}
            height={28}
          />
          <div className="flex items-center gap-6 text-[13px] font-medium text-white/90">
            <a href="#about" className="transition-opacity hover:opacity-60">
              About
            </a>
            <a href="#tracks" className="transition-opacity hover:opacity-60">
              Tracks
            </a>
            <a href="#sponsors" className="transition-opacity hover:opacity-60">
              Sponsors
            </a>
            <a href="#faqs" className="transition-opacity hover:opacity-60">
              FAQs
            </a>
          </div>
          <a
            href="#register"
            className="rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-sm transition-all hover:bg-white/25"
          >
            Register Now
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen flex-col overflow-hidden">
        <Image
          src="/hero_bg_w_overlay.png"
          alt="MHacks 2026"
          fill
          className="object-cover object-top"
          priority
        />
        {/* gradient: transparent top → dark bottom for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

        <div className="relative z-10 mt-auto px-16 pb-20">
          <h1 className="font-heading text-[clamp(4.5rem,10.5vw,9rem)] font-black leading-[0.9] tracking-tight text-white">
            MHACKS 2026
          </h1>
          <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-white/55">
            Michigan&apos;s premier student hackathon.
            <br />
            36 hours. Limitless ideas.
          </p>
          <div className="mt-8" id="register">
            <a
              href="#about"
              className="inline-flex items-center rounded-full border border-[#8a9a50]/40 bg-[#5c6b2e]/75 px-7 py-3 text-sm font-semibold text-white/95 shadow-[0_4px_24px_rgba(92,107,46,0.35)] backdrop-blur-sm transition-all hover:bg-[#5c6b2e] hover:shadow-[0_6px_32px_rgba(92,107,46,0.5)]"
            >
              Register Now
            </a>
          </div>
        </div>
      </section>

      {/* ── Calling All Hackers ── */}
      <section
        id="about"
        className="scroll-mt-20 relative overflow-hidden bg-white px-16 py-24"
      >
        {/* subtle right-side nature wash */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-15">
          <Image
            src="/white_green_bg.png"
            alt=""
            fill
            className="object-cover object-top"
          />
        </div>

        <div className="relative mx-auto flex max-w-6xl items-center gap-20">
          {/* Text */}
          <div className="flex-1">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              Welcome
            </p>
            <h2 className="text-4xl font-bold tracking-tight text-zinc-900">
              Calling All Hackers
            </h2>
            <p className="mt-6 max-w-md text-[14px] leading-7 text-zinc-500">
              MHacks is the University of Michigan&apos;s flagship hackathon,
              bringing together the brightest student minds from across the
              country. Over 36 hours, you&apos;ll collaborate, create, and
              compete for over $30,000 in prizes.
            </p>
            <p className="mt-4 max-w-md text-[14px] leading-7 text-zinc-500">
              Whether you&apos;re a seasoned hacker or attending your very first
              hackathon, MHacks is the place to turn your wildest ideas into
              reality. Join us for a weekend of innovation, mentorship, and
              community.
            </p>
          </div>

          {/* Liquid glass image panel */}
          <div className="relative flex-shrink-0">
            <div className="relative h-72 w-64 overflow-hidden rounded-[2rem] border border-white/50 shadow-[0_24px_64px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.8)]">
              <Image
                src="/hackers_blurred_box.png"
                alt="MHacks atmosphere"
                fill
                className="object-cover"
              />
              {/* glass sheen overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent" />
              <div className="absolute inset-x-0 top-0 h-px bg-white/60" />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative mx-auto mt-20 max-w-6xl border-y border-zinc-100 py-7">
          <div className="flex items-center justify-center gap-12">
            {[
              { value: "1000+", label: "Hackers" },
              { value: "$30k+", label: "in prizes" },
              { value: "200+", label: "Projects" },
            ].map((stat, i, arr) => (
              <div key={stat.label} className="flex items-center gap-12">
                <div className="text-center">
                  <p className="text-xl font-bold text-zinc-800">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    {stat.label}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <div className="h-7 w-px bg-zinc-150 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tracks ── */}
      <section
        id="tracks"
        className="scroll-mt-20 relative overflow-hidden py-28"
      >
        <Image
          src="/white_green_bg.png"
          alt=""
          fill
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-white/75" />

        <div className="relative mx-auto max-w-6xl px-16">
          <p className="mb-16 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Tracks
          </p>
          <div className="grid grid-cols-4 gap-10">
            {tracks.map((track) => (
              <div
                key={track.name}
                className="flex flex-col items-center text-center"
              >
                {/* Liquid glass circular frame */}
                <div className="relative mb-6 flex h-44 w-44 items-center justify-center rounded-full border border-white/70 bg-white/45 shadow-[0_8px_32px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(255,255,255,0.3)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
                  <Image
                    src={track.flower}
                    alt={track.name}
                    width={168}
                    height={168}
                    className="object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                  />
                </div>
                <h3 className="text-[13px] font-semibold text-zinc-700">
                  {track.name}
                </h3>
                <p className="mt-1.5 text-[12px] leading-5 text-zinc-400">
                  {track.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sponsors ── */}
      <section
        id="sponsors"
        className="scroll-mt-20 relative overflow-hidden py-28"
      >
        <Image
          src="/sponsors_bg.png"
          alt=""
          fill
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 mx-auto max-w-6xl px-16">
          <div className="mb-10 flex justify-end">
            <h2 className="text-xl font-bold tracking-tight text-white/90">
              Our Sponsors
            </h2>
          </div>

          {/* Liquid glass sponsor panel */}
          <div className="rounded-3xl border border-white/15 bg-white/[0.06] px-14 py-12 shadow-[0_24px_64px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
            {/* Diamond tier */}
            <div className="mb-10 flex items-center justify-center gap-20">
              {sponsors.diamond.map((s) => (
                <span
                  key={s}
                  className="text-[1.75rem] font-bold tracking-tight text-white"
                >
                  {s}
                </span>
              ))}
            </div>

            <div className="mx-auto mb-9 h-px w-2/3 bg-white/[0.08]" />

            {/* Gold tier */}
            <div className="mb-9 flex items-center justify-center gap-14">
              {sponsors.gold.map((s) => (
                <span key={s} className="text-lg font-semibold text-white/80">
                  {s}
                </span>
              ))}
            </div>

            <div className="mx-auto mb-9 h-px w-2/3 bg-white/[0.08]" />

            {/* Silver tier */}
            <div className="mb-9 flex flex-wrap items-center justify-center gap-10">
              {sponsors.silver.map((s) => (
                <span key={s} className="text-[15px] font-medium text-white/65">
                  {s}
                </span>
              ))}
            </div>

            <div className="mx-auto mb-9 h-px w-2/3 bg-white/[0.08]" />

            {/* Bronze tier */}
            <div className="flex flex-wrap items-center justify-center gap-7">
              {sponsors.bronze.map((s) => (
                <span key={s} className="text-[13px] text-white/45">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQs ── */}
      <section
        id="faqs"
        className="scroll-mt-20 bg-white px-16 py-24"
      >
        <div className="mx-auto flex max-w-6xl items-start gap-24">
          {/* Accordion */}
          <div className="flex-1">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              Questions
            </p>
            <h2 className="mb-10 text-3xl font-bold tracking-tight text-zinc-900">
              FAQs
            </h2>
            <FaqAccordion />
          </div>

          {/* Decorative flower */}
          <div className="relative mt-4 w-60 flex-shrink-0 self-start">
            {/* soft pink bloom behind the vase */}
            <div className="absolute bottom-8 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-pink-100/70 blur-3xl" />
            <Image
              src="/pink_flower_in_vase.png"
              alt="Decorative flower in vase"
              width={240}
              height={360}
              className="relative object-contain"
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-100 bg-white px-16 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-[12px] text-zinc-400">
          <div className="flex items-center gap-3">
            <Image
              src="/mhacks_logo.png"
              alt="MHacks"
              width={18}
              height={18}
              className="opacity-25"
            />
            <span>© 2026 MHacks. University of Michigan.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="transition-colors hover:text-zinc-700">
              Code of Conduct
            </a>
            <a href="#" className="transition-colors hover:text-zinc-700">
              Privacy
            </a>
            <a href="#" className="transition-colors hover:text-zinc-700">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
