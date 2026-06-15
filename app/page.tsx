import Image from "next/image";
import FaqAccordion from "@/components/faq-accordion";
import PhotoGrid from "@/components/photo-grid";
import HeroSection from "@/components/hero-section";
import NavBar from "@/components/navbar";

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

const timelineEvents = [
  {
    date: "Jun. 22",
    title: "Applications Open",
    desc: "The MHacks 2026 application portal goes live. Start your application early — spots are limited.",
  },
  {
    date: "Aug. 07",
    title: "Early Application Deadline",
    desc: "Early applications must be submitted by 11:59 PM ET. No late submissions accepted.",
  },
  {
    date: "Aug. 21",
    title: "Early Decisions Released",
    desc: "Early admission decisions will be sent to all applicants via email. Check your inbox.",
  },
  {
    date: "Sep. 04",
    title: "Regular Applications Deadline",
    desc: "Regular applications must be submitted by 11:59 PM ET. No late submissions accepted.",
  },
  {
    date: "Sep. 11",
    title: "Regular Recisions Released",
    desc: "Regular admission decisions will be sent to all applicants via email. Check your inbox.",
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
      <NavBar />

      {/* ── Hero ── */}
      <HeroSection />

      {/* ── About ── */}
      <section
        id="about"
        className="scroll-mt-20 relative overflow-hidden bg-white"
      >
        <div className="pointer-events-none absolute right-0 top-0 h-full w-full lg:w-[62%] opacity-15">
          <Image
            src="/white_green_bg.png"
            alt=""
            fill
            className="object-cover object-top"
          />
        </div>

        <div className="relative flex flex-col lg:flex-row lg:min-h-[680px] items-stretch">
          {/* Text */}
          <div className="flex w-full lg:w-[38%] flex-col justify-center items-center lg:items-start px-8 sm:px-12 lg:px-16 py-16 lg:py-24">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400 text-center lg:text-left">
              About MHacks
            </p>
            <h2
              className="font-heading italic text-4xl sm:text-5xl leading-tight tracking-tight text-center lg:text-left"
              style={{ color: "#3A4A26" }}
            >
              Calling All Hackers
            </h2>
            <p className="mt-6 max-w-md text-[14px] leading-7 text-zinc-500 text-center lg:text-left">
              MHacks is the University of Michigan&apos;s flagship hackathon,
              bringing together the brightest student minds from across the
              country. Over 36 hours, you&apos;ll collaborate, create, and
              compete for over $30,000 in prizes.
            </p>
            <p className="mt-4 max-w-md text-[14px] leading-7 text-zinc-500 text-center lg:text-left">
              Whether you&apos;re a seasoned hacker or attending your very first
              hackathon, MHacks is the place to turn your wildest ideas into
              reality. Join us for a weekend of innovation, mentorship, and
              community.
            </p>
          </div>

          {/* Photo grid */}
          <div className="w-full h-[360px] lg:h-auto lg:w-[62%] pl-4 lg:pl-6 pr-4 lg:pr-8 pt-4 lg:pt-8 pb-4 lg:pb-8">
            <PhotoGrid />
          </div>
        </div>

        {/* Stats carousel */}
        <div
          className="border-y overflow-hidden py-8"
          style={{ borderColor: "#44572155" }}
        >
          <div className="flex animate-scroll-left">
            {[
              { value: "1000+", label: "Hackers" },
              { value: "$30k+", label: "in prizes" },
              { value: "200+", label: "Projects" },
              { value: "1000+", label: "Hackers" },
              { value: "$30k+", label: "in prizes" },
              { value: "200+", label: "Projects" },
            ].map((stat, i) => (
              <div key={i} className="flex items-center shrink-0">
                <p
                  className="font-heading italic text-xl sm:text-5xl whitespace-nowrap px-8 sm:px-16"
                  style={{ color: "#445721" }}
                >
                  {stat.value} {stat.label}
                </p>
                <span
                  className="font-heading italic text-xl sm:text-5xl shrink-0"
                  style={{ color: "#445721" }}
                >
                  ·
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tracks ── */}
      <section
        id="tracks"
        className="scroll-mt-20 relative bg-white py-20 sm:py-28 overflow-hidden"
      >
        {/* ASCII rose background elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
          {/* Top-left rose */}
          <pre
            className="absolute font-mono leading-snug"
            style={{
              color: "#3A4A26",
              opacity: 0.22,
              fontSize: "0.72rem",
              top: "2%",
              left: "1%",
            }}
          >{`      .      .'
        :\`...' \`.,'  '
    \`.  ' .**.  ; ; ':
    \` \`\`:\`****,'  .' :
  ..::.  \`\`**":.''   \`.
.:    \`: ; \`,'        :
  \`:    \`   :         ;
    :   :   :        ;
    :    :   :     .:
     :    :   :..,'  \`\`::.
      \`....:..'  ..:;''
      .:   . ...::::
     ,'''''  \`\`:::::::
               \`::::
                 \`::.
                  \`::
           . ,.    ::::'      ,..
         .'.'  \`\`.  ::      .'.. \`.
        '        .: ::    ,'.'     .
      .' ,'    .::::::   ,.'    .:::.
    .' .'  ..:'     ::: .,   .;'     ~
   ,;::;.::''        ::.:..::'
  ~                  ::;'
                     ::
                   ,:::
                     ::.
                     \`::
                      ::
                      ::
                      ::
                      ::
                      ::`}</pre>

          {/* Bottom-right rose */}
          <pre
            className="absolute font-mono leading-snug"
            style={{
              color: "#3A4A26",
              opacity: 0.22,
              fontSize: "0.72rem",
              bottom: "2%",
              right: "1%",
            }}
          >{`                                    .,,.
            .,v%;mmmmmmmm;%%vv,.
         ,vvv%;mmmvv;vvvmmm;%vvvv,    .,,.
  ,, ,vvvnnv%;mmmvv;%%;vvmmm;%vvvv%;mmmmmmm,
,mmmmmm;%%vv%;mmmvv;%%;vvmmm;%v%;mmmmmmmmmmm
mmmmmmmmmmm;%%;mmmvv%;vvmmm;%mmmmmmmmmmmmmm'
\`mmmmmmmmmmmmmm%;mmv;vmmm;mmmmmmm;%vvvvvv'
    \`%%%%%;mmmmmmmm;v%v;mmmmmm;%vvvnnvv'
     vvvvvv%%%%;mmmm%;mmmmmm;%vvvnnnnvv
     \`vvnnnnvvv%%%;m;mmmmm;%vvnnmmnnvv'
      vvnmmnnnnvvv%%mmmm;%vvnnmmmnnnvv
      \`vvnmmmnnvvv%mmm;%vvnnmmmmnnnvv'
       \`vvnmmmmvv%mmm;%vvnnmmmmnnnvv'
        \`vvnmmmvv%mm;%vvvnnmmmnnvvv'
          \`vvnmmvv%m;%vvvvnmnvvvv'
           .;;vvvvvm;%vvvvvvvv'
        .;;;;;;;;;;;;;;;;;;;;,
       ;;;;;;';;;;;;;;;;;'\`;;;;;,
      .;;;'    \`;;;;;;;;'   \`;;;;;.
     .;;'        \`;;;;;'      \`;;;;
     ;'           :\`;;'         ;;'
     ;            : ;'    ,    ,'             .
      \`           :'.:   .;;,.        .,;;;;;;'
                  ::::   ;;,;;;,     ;;;,;;;;'
                  ;;;;   \`;;;,;;    .,';;;;'
                  ;;;;      \`';; ,;;'
                ,;;;;;         .;',.
                  \`;;;;       .;'  ';,.
                   \`;;;.     .;'   ,;;,;;,.
                    ;;;;    .;'    \`;;;;,;;;
                    ;;;;   .;'       \`;;,;;'
                    \`;;;,;;'           \`;'
                     ;;;;
                     ;;;;.
                     \`;;;;;,.
                      ;;;;'
                      ;;;;
                      ;;;;`}</pre>
        </div>

        <div className="relative mx-auto max-w-6xl px-8 sm:px-16">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Tracks
          </p>
          <h2
            className="mb-14 sm:mb-20 font-heading italic text-4xl sm:text-5xl leading-tight tracking-tight"
            style={{ color: "#3A4A26" }}
          >
            Choose Your Focus
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
            {tracks.map((track) => (
              <div
                key={track.name}
                className="flex flex-col items-center text-center"
              >
                <div
                  className="group relative mb-6 flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-full border shadow-[0_8px_32px_rgba(58,74,38,0.08)] transition-all duration-300 hover:scale-105 hover:shadow-[0_16px_48px_rgba(58,74,38,0.14)]"
                  style={{
                    background: "rgba(58,74,38,0.04)",
                    borderColor: "rgba(58,74,38,0.12)",
                  }}
                >
                  <Image
                    src={track.flower}
                    alt={track.name}
                    width={130}
                    height={130}
                    className="object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-transform duration-500 group-hover:rotate-12"
                  />
                </div>
                <h3
                  className="font-heading italic text-xl sm:text-2xl leading-tight"
                  style={{ color: "#3A4A26" }}
                >
                  {track.name}
                </h3>
                <p className="mt-2 text-[12px] leading-5 text-zinc-400">
                  {track.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section
        id="timeline"
        className="scroll-mt-20 relative bg-white py-20 sm:py-28 overflow-hidden"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-full opacity-[0.07]">
          <Image
            src="/white_green_bg.png"
            alt=""
            fill
            className="object-cover object-top"
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-8 sm:px-16">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Applications
          </p>
          <h2
            className="mb-14 sm:mb-20 font-heading italic text-4xl sm:text-5xl leading-tight tracking-tight"
            style={{ color: "#3A4A26" }}
          >
            Key Dates
          </h2>

          {/* Mobile: vertical */}
          <div className="lg:hidden">
            {timelineEvents.map((event, i) => (
              <div key={event.title} className="flex">
                <div className="flex flex-col items-center w-5 shrink-0">
                  <div
                    className="w-[9px] h-[9px] rounded-full border-[2px] bg-white mt-[5px] z-10 shrink-0"
                    style={{ borderColor: "#3A4A26" }}
                  />
                  {i < timelineEvents.length - 1 && (
                    <div
                      className="w-px flex-1 mt-1"
                      style={{
                        backgroundColor: "rgba(58,74,38,0.15)",
                        minHeight: "4rem",
                      }}
                    />
                  )}
                </div>
                <div className="flex-1 pl-5 pb-8">
                  <span
                    className="font-mono text-[13px] font-semibold block mb-1"
                    style={{ color: "rgba(58,74,38,0.55)" }}
                  >
                    {event.date}
                  </span>
                  <h3
                    className="font-heading italic text-2xl leading-tight mb-1.5"
                    style={{ color: "#3A4A26" }}
                  >
                    {event.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-zinc-400">
                    {event.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: horizontal, alternating above/below */}
          <div className="hidden lg:block">
            <div className="relative flex">
              <div
                className="absolute left-0 right-0 h-px z-0"
                style={{
                  top: "calc(7rem + 4px)",
                  backgroundColor: "rgba(58,74,38,0.2)",
                }}
              />
              {timelineEvents.map((event, i) => (
                <div
                  key={event.title}
                  className="flex-1 flex flex-col items-center"
                >
                  {/* Above-line */}
                  <div className="h-28 flex flex-col justify-end items-center pb-4 text-center px-3">
                    {i % 2 === 0 && (
                      <>
                        <span
                          className="font-mono text-[12px] font-bold tracking-wider mb-2 block"
                          style={{ color: "rgba(58,74,38,0.6)" }}
                        >
                          {event.date}
                        </span>
                        <h3
                          className="font-heading italic text-xl leading-snug"
                          style={{ color: "#3A4A26" }}
                        >
                          {event.title}
                        </h3>
                      </>
                    )}
                  </div>

                  {/* Dot */}
                  <div
                    className="w-[9px] h-[9px] rounded-full border-[2px] bg-white z-10 shrink-0"
                    style={{ borderColor: "#3A4A26" }}
                  />

                  {/* Below-line */}
                  <div className="h-28 flex flex-col justify-start items-center pt-4 text-center px-3">
                    {i % 2 === 1 && (
                      <>
                        <span
                          className="font-mono text-[12px] font-bold tracking-wider mb-2 block"
                          style={{ color: "rgba(58,74,38,0.6)" }}
                        >
                          {event.date}
                        </span>
                        <h3
                          className="font-heading italic text-xl leading-snug"
                          style={{ color: "#3A4A26" }}
                        >
                          {event.title}
                        </h3>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Sponsors ── */}
      <section id="sponsors" className="scroll-mt-20 bg-white px-3 pb-3">
        <div className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden rounded-[2rem] py-20 sm:py-28">
          <Image
            src="/sponsors_bg.png"
            alt=""
            fill
            className="object-cover object-center brightness-[1.15] contrast-[1.2] saturate-[1.3]"
          />
          <div className="absolute inset-0 bg-black/50" />

          <div className="relative z-10 flex flex-col items-center text-center px-8 sm:px-16">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/60">
              Powering MHacks
            </p>
            <h2 className="mb-10 font-heading italic text-5xl sm:text-7xl leading-tight tracking-tight text-white">
              Our Sponsors
            </h2>

            <p className="mb-10 font-heading italic text-2xl sm:text-3xl text-white/70">
              Coming Soon...
            </p>

            <div className="flex flex-col items-center gap-3">
              <p className="text-[13px] text-white/50">
                Interested in supporting MHacks 2026?
              </p>
              <a
                href="mailto:sponsors@mhacks.org"
                className="rounded-full border border-white/25 bg-white/10 px-7 py-2.5 text-[14px] font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/40"
              >
                Sponsor Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQs ── */}
      <section
        id="faqs"
        className="scroll-mt-20 bg-white px-8 sm:px-16 py-16 sm:py-24"
      >
        <div className="mx-auto flex max-w-6xl flex-col lg:flex-row items-stretch gap-12 lg:gap-16">
          <div className="flex-1 w-full">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              Attending MHacks
            </p>
            <h2
              className="mb-10 font-heading italic text-4xl sm:text-5xl leading-tight tracking-tight"
              style={{ color: "#3A4A26" }}
            >
              FAQs
            </h2>
            <FaqAccordion />
          </div>

          <div className="relative hidden lg:block w-[420px] my-2 mx-3 overflow-hidden rounded-3xl shadow-[inset_-32px_0_40px_rgba(0,0,0,0.28)]">
            {/* Oversized wrapper so rotated bg always covers the container */}
            <div
              className="absolute pointer-events-none"
              style={{
                width: "160%",
                height: "160%",
                top: "-30%",
                left: "-30%",
                transform: "rotate(90deg)",
              }}
            >
              <Image
                src="/white_green_bg.png"
                alt=""
                fill
                className="object-cover"
              />
            </div>
            <div className="absolute bottom-8 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-pink-100/80 blur-3xl" />
            <Image
              src="/pink_flower_in_vase.png"
              alt="Decorative flower in vase"
              fill
              className="object-contain -scale-x-100 blur-[2px]"
            />
            <Image
              src="/pink_ascii_flower.png"
              alt=""
              fill
              className="object-contain"
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-100 bg-white px-8 sm:px-16 py-8">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-zinc-400">
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
            <a
              href="mailto:hackathon-org@umich.edu"
              className="transition-colors hover:text-zinc-700"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
