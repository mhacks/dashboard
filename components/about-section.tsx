import AboutFlowers from "@/components/about-flowers";

export default function AboutSection() {
  return (
    <section
      id="about"
      className="relative scroll-mt-20 overflow-visible"
      style={{ backgroundColor: "rgba(244, 242, 232, 0.55)" }}
    >
      <AboutFlowers />
      <div className="relative z-10 flex flex-col items-center px-8 sm:px-12 lg:px-16 pt-16 lg:pt-24 pb-16">
        <h2
          className="text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight text-center"
          style={{ color: "#3A4A26" }}
        >
          <span className="font-sans font-normal">Calling All </span>
          <span className="font-heading italic">Hackers</span>
        </h2>
        <p
          className="font-red-hat mt-6 max-w-xl text-lg leading-7 text-center"
          style={{ color: "rgba(58,74,38,0.65)" }}
        >
          MHacks is the University of Michigan&apos;s flagship hackathon,
          bringing together the brightest student minds from across the country.
          Over 24 hours, you&apos;ll collaborate, create, and compete for over
          $40,000 in prizes.
        </p>
        <p
          className="font-red-hat mt-4 max-w-xl text-lg leading-7 text-center"
          style={{ color: "rgba(58,74,38,0.65)" }}
        >
          Whether you&apos;re a seasoned hacker or attending your very first
          hackathon, MHacks is the place to turn your wildest ideas into
          reality. Join us for a weekend of innovation, mentorship, and
          community.
        </p>
      </div>
    </section>
  );
}
