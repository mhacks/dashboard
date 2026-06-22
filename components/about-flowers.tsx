export default function AboutFlowers() {
  return (
    <>
      <div
        className="pointer-events-none absolute -bottom-16 left-4 z-[1] lg:-bottom-20 lg:left-4"
        aria-hidden
      >
        <img
          src="/pixel_flowers_green.svg"
          alt=""
          width={442}
          height={782}
          className="h-auto w-[min(24vw,220px)] max-w-none select-none sm:w-[min(22vw,200px)] lg:w-[min(22vw,260px)]"
        />
      </div>
      <div
        className="pointer-events-none absolute bottom-0 right-0 z-[1]"
        aria-hidden
      >
        <img
          src="/pixel_flowers_blue.svg"
          alt=""
          width={412}
          height={692}
          className="ml-auto block h-auto w-[min(24vw,220px)] max-w-none select-none sm:w-[min(22vw,200px)] lg:w-[min(22vw,260px)]"
        />
      </div>
    </>
  );
}
