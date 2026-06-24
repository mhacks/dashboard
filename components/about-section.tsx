import AboutFlowers from "@/components/about-flowers";

export default function AboutSection() {
  return (
    <section
      id="about"
      className="relative scroll-mt-20 overflow-visible"
      style={{ backgroundColor: "rgba(244, 242, 232, 0.55)" }}
    >
      <AboutFlowers />
      <div className="relative z-10 mx-auto flex w-full max-w-[641px] flex-col items-center gap-10 px-8 pt-16 pb-64 sm:px-12 lg:pt-32 lg:pb-32">
        <div className="flex w-full flex-col items-center gap-1.5">
          <p className="font-red-hat text-lg font-semibold leading-[1.3] text-center text-black/50">
            About MHacks
          </p>
          <h2
            className="text-5xl leading-[1.1] tracking-tight text-center sm:text-6xl lg:text-[72px]"
            style={{ color: "#3A4A26" }}
          >
            <span className="font-red-hat font-semibold">Calling All </span>
            <span className="font-heading italic">Hackers</span>
          </h2>
        </div>
        <div
          className="font-red-hat flex w-full flex-col gap-10 text-left text-lg font-medium leading-[1.5] lg:text-xl"
          style={{ color: "#262626" }}
        >
          <p>
            MHacks is the University of Michigan&apos;s flagship hackathon,
            bringing together the brightest student minds from across the
            country.
            <br />
            <br />
            Over 24 hours, you&apos;ll collaborate, create, and compete for over
            $40,000 in prizes.
          </p>
          <p>
            Whether you&apos;re a seasoned hacker or attending your first
            hackathon, MHacks is the place to turn your wildest ideas into
            reality.
            <br />
            <br />
            Join us for a weekend of innovation, mentorship, and community.
          </p>
        </div>
      </div>
    </section>
  );
}
