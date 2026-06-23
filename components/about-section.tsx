import AboutFlowers from "@/components/about-flowers";

export default function AboutSection() {
  return (
    <section
      id="about"
      className="relative scroll-mt-20 overflow-visible"
      style={{ backgroundColor: "rgba(244, 242, 232, 0.55)" }}
    >
      <AboutFlowers />
      <div className="relative z-10 flex flex-col items-center px-8 sm:px-12 lg:px-16 pt-16 lg:pt-24 pb-16 gap-10">
        <div className="flex flex-col items-center gap-1.5">
          <p
            className="font-red-hat font-semibold text-[18px] text-center text-black opacity-50"
          >
            About MHacks
          </p>
          <h2
            className="font-red-hat font-semibold text-4xl sm:text-5xl lg:text-[72px] leading-[1.1] tracking-tight text-center"
            style={{ color: "#3A4A26" }}
          >
            Calling All{" "}
            <span className="font-heading italic">Hackers</span>
          </h2>
        </div>
        <div
          className="font-red-hat font-medium flex flex-col gap-10 max-w-[641px] w-full text-lg sm:text-xl leading-relaxed"
          style={{ color: "#262626" }}
        >
          <p>
            MHacks is the University of Michigan&apos;s flagship hackathon,
            bringing together the brightest student minds from across the country.
            <br /><br />
            Over 24 hours, you&apos;ll collaborate, create, and compete for over
            $40,000 in prizes.
          </p>
          <p>
            Whether you are a seasoned hacker or attending your first
            hackathon, MHacks is the place to turn your wildest ideas into reality.
            <br /><br />
            Join us for a weekend of innovation, mentorship, and community.
          </p>
        </div>
      </div>
    </section>
  );
}
