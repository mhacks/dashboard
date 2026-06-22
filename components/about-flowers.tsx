export default function AboutFlowers() {
  return (
    <>
      <div
        className="pointer-events-none absolute -bottom-32 left-0 z-[1] hidden md:block lg:-bottom-40"
        aria-hidden
      >
        <img
          src="/pixel_flowers_green.svg"
          alt=""
          width={442}
          height={782}
          className="h-auto w-[min(30vw,280px)] max-w-none select-none [image-rendering:pixelated] lg:w-[min(28vw,320px)]"
        />
      </div>
      <div
        className="pointer-events-none absolute -bottom-32 right-0 z-[1] hidden md:block lg:-bottom-40"
        aria-hidden
      >
        <img
          src="/pixel_flowers_blue.svg"
          alt=""
          width={412}
          height={692}
          className="h-auto w-[min(30vw,280px)] max-w-none select-none [image-rendering:pixelated] lg:w-[min(28vw,320px)]"
        />
      </div>
    </>
  );
}
