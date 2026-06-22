import Image from "next/image";

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
        <h2
          className="text-center font-sans font-normal text-3xl tracking-tight md:text-4xl lg:text-5xl"
          style={{ color: "#3A4A26" }}
        >
          Remember{" "}
          <span
            className="font-heading bg-[rgb(58,74,38)] italic"
            style={{ color: "rgb(255, 255, 255)" }}
          >
            &nbsp;MHacks 2025?&nbsp;
          </span>
        </h2>
      </div>

      <div className="relative mt-20">
        <PhotoCarousel />
      </div>
    </section>
  );
}
