import Image from "next/image";

export default function AboutFlowers() {
  return (
    <>
      <div
        className="pointer-events-none absolute top-1/2 left-0 z-[1] hidden -translate-y-1/2 md:block"
        aria-hidden
      >
        <Image
          src="/pixel_flowers_green.svg"
          alt=""
          width={442}
          height={782}
          className="h-auto w-[min(30vw,280px)] max-w-none select-none [image-rendering:pixelated] lg:w-[min(28vw,320px)]"
        />
      </div>
      <div
        className="pointer-events-none absolute top-1/2 right-0 z-[1] hidden -translate-y-1/2 md:block"
        aria-hidden
      >
        <Image
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
