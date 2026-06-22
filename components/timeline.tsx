"use client";

import Image from "next/image";

const items = [
    {
        title: "Hacker Applications Open",
        date: "June 22nd",
        color: "pink",
        className: "left-[7%] top-[55%] -rotate-[7deg]",
    },
    {
        title: "Early Applications Due",
        date: "August 7th",
        color: "blue",
        className: "left-[23%] top-[60%] -rotate-[8deg]",
    },
    {
        title: "Early Decisions Released",
        date: "August 14th",
        color: "pink",
        className: "left-[40%] top-[70%] -rotate-[8deg]",
    },
    {
        title: "Regular Applications Due",
        date: "September 12th",
        color: "blue",
        className: "left-[55%] top-[78%] -rotate-[8deg]",
    },
    {
        title: "Regular Decisions Released",
        date: "September 19th, 2026",
        color: "pink",
        className: "left-[70%] top-[80%] -rotate-[8deg]",
    },
] as const;

export default function ApplicationTimeline() {
    return (
        // <section className="relative h-screen w-full overflow-hidden bg-[#F3F1E8]">
        //   <Image
        //     src="/timeline.svg"
        //     alt=""
        //     fill
        //     priority
        //     className="
        //       pointer-events-none
        //       select-none
        //       object-cover
        //       object-[65%_45%]
        //       translate-x-[2%]
        //     "
        //   />

        //   {/* {items.map((item) => (
        //     <div
        //       key={item.title}
        //       className={`absolute z-20 ${item.className}`}
        //     >
        //       <Sticker {...item} />
        //     </div>
        //   ))} */}
        // </section>
        <section className="relative h-screen w-full overflow-hidden bg-[#F3F1E8]">
            <div className="absolute inset-0 translate-x-[8%] scale-[1.12]">
            <Image
            src="/timeline.svg"
            alt=""
            fill

            className="
              pointer-events-none
              select-none
              object-cover
              object-[65%_45%]
              translate-x-[-5.7%]
              scale-[0.90]
            "
          />
            </div>

            <div className="absolute left-1/2 top-[10%] z-20 w-full -translate-x-1/2 px-6 text-center">
                <h2 className="font-sans text-[clamp(42px,5vw,76px)] font-semibold tracking-tight text-[#354A2A]">
                    Timeline
                </h2>

                
            </div>
            <div className="absolute left-[25%] top-[90%] z-20 w-full -translate-x-1/2 px-6 text-center">
                <p className="mx-auto mt-5 max-w-[680px] text-[clamp(12px,1vw,15px)] leading-relaxed text-[#73736E]">
                    Did you know? <em>Wild</em> Lily of the Valley is a species{" "}
                    <em>highly</em> native to Michigan.
                    <br />
                    <em>Common</em> Lily of the Valley, however, is classified as invasive and aggressive.
                </p>
            </div>
            
        </section>
    );
}

function Sticker({
    title,
    date,
    color,
}: {
    title: string;
    date: string;
    color: "pink" | "blue";
}) {
    const titleBg = color === "pink" ? "#FFD4EE" : "#D8EAFF";
    const titleColor = color === "pink" ? "#7A0044" : "#08267E";

    return (
        <div className="flex flex-col items-start whitespace-nowrap">
            <div
                className="px-[1.4vw] py-[0.55vw] font-sans text-[clamp(13px,1.35vw,22px)] font-bold shadow-lg"
                style={{ backgroundColor: titleBg, color: titleColor }}
            >
                {title}
            </div>

            <div className="-mt-[0.25vw] ml-[0.8vw] bg-[#FFFCA8] px-[1.4vw] py-[0.55vw] font-heading text-[clamp(15px,1.6vw,26px)] text-[#7A5F21] shadow-lg">
                {date}
            </div>
        </div>
    );
}