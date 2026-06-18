import Image from "next/image";

const STATS = [
  { value: "$40k+", caption: "Prize pool across all tracks" },
  { value: "350+", caption: "Projects shipped in a weekend" },
  { value: "24 hrs", caption: "Of building, start to demo" },
  { value: "14", caption: "Editions since 2013" },
];

const PHOTOS = [
  { src: "/c_pic1.jpg" },
  { src: "/c_pic2.jpg" },
  { src: "/c_pic3.jpg" },
  { src: "/c_pic4.jpg" },
  { src: "/c_pic5.jpg" },
  { src: "/c_pic6.jpg" },
  { src: "/c_pic7.jpg" },
  { src: "/c_pic8.jpg" },
  { src: "/c_pic9.jpg" },
  { src: "/c_pic10.jpg" },
];

function PhotoCarousel() {
  return (
    <div className="group overflow-hidden">
      <div className="flex w-max gap-4 px-2 animate-[marquee_55s_linear_infinite] group-hover:[animation-play-state:paused]">
        {[...PHOTOS, ...PHOTOS].map((p, i) => (
          <div
            key={i}
            className="h-56 w-80 shrink-0 overflow-hidden rounded-2xl md:h-72 md:w-[26rem]"
            style={{ border: "1px solid rgba(31,42,22,0.08)" }}
          >
            <Image
              src={p.src}
              alt=""
              width={416}
              height={288}
              className="h-full w-full object-cover object-center"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsBand() {
  return (
    <section className="relative overflow-hidden py-28 md:py-36">
      {/* ASCII background */}
      <Image
        src="/sponsors-ascii.png"
        alt=""
        fill
        sizes="100vw"
        className="object-cover opacity-50"
      />
      {/* Paper overlay */}
      <div className="absolute inset-0 bg-paper/82" />
      {/* Edge fades */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-paper to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-paper to-transparent" />

      <div className="relative mx-auto max-w-6xl px-5 md:px-10">
        <p
          className="font-red-hat text-center text-[11px] font-light uppercase tracking-[0.3em] flex items-center justify-center gap-2"
          style={{ color: "rgba(58,74,38,0.5)" }}
        >
          <span>◆</span>By The Numbers<span>◆</span>
        </p>
        <h2
          className="mt-6 text-center font-sans font-semibold text-4xl md:text-6xl tracking-tight"
          style={{ color: "#3A4A26" }}
        >
          Remember{" "}
          <span
            className="font-heading italic"
            style={{ color: "rgba(58,74,38,0.6)" }}
          >
            MHacks 2025?
          </span>
        </h2>

        <div className="mt-16 grid grid-cols-2 gap-y-12 md:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.caption}
              className="border-l px-6 md:px-8"
              style={{ borderColor: "rgba(31,42,22,0.15)" }}
            >
              <p
                className="font-red-hat text-4xl font-semibold md:text-5xl"
                style={{ color: "#3A4A26" }}
              >
                {s.value}
              </p>
              <p
                className="font-red-hat mt-3 max-w-[170px] text-[10px] uppercase leading-relaxed tracking-[0.18em]"
                style={{ color: "rgba(58,74,38,0.6)" }}
              >
                {s.caption}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-20">
        <PhotoCarousel />
      </div>
    </section>
  );
}
