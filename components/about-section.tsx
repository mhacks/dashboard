"use client";

import { motion } from "framer-motion";

export default function AboutSection() {
    return (
        <section
            id="about"
            className="scroll-mt-20 relative overflow-hidden min-h-[760px]"
            style={{ backgroundColor: "rgba(244, 242, 232, 0.55)" }}
        >
            <motion.img
                src="/neon_flower_1.svg"
                alt=""
                aria-hidden="true"
                initial={{ opacity: 0, y: -60, rotate: -15 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.35 }}
                className="pointer-events-none absolute left-[0px]  z-0 w-[clamp(320px,28vw,560px)] opacity-80"
            />

            <motion.img
                src="/neon_flower_2.svg"
                alt=""
                aria-hidden="true"
                initial={{ opacity: 0, y: -60, rotate: 15 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
                viewport={{ once: true, amount: 0.35 }}
                className="pointer-events-none absolute right-[0px] z-0 w-[clamp(320px,28vw,560px)] opacity-80"
            />

            <div className="relative z-10 flex flex-col items-center px-8 sm:px-12 lg:px-16 pt-16 lg:pt-24 pb-16">
                <p
                    className="font-red-hat mb-3 text-[14px] font-semibold uppercase tracking-[0.3em] text-center flex items-center gap-2"
                    style={{ color: "rgba(58,74,38,0.5)" }}
                >
                    <span>★</span>
                    About MHacks
                    <span>★</span>
                </p>

                <h2
                    className="text-5xl sm:text-6xl leading-tight tracking-tight text-center"
                    style={{ color: "#3A4A26" }}
                >
                    <span className="font-sans font-semibold">Calling all</span>{" "}
                    <span
                        className="font-heading font-semibold italic bg-[rgb(58,74,38)]"
                        style={{ color: "#f7f5ee" }}
                    >
                        &nbsp;hackers&nbsp;
                    </span>
                </h2>

                <p
                    className="font-red-hat mt-6 max-w-xl text-[24px] leading-7 text-center"
                    style={{ color: "rgba(58,74,38,0.65)" }}
                >
                    MHacks is the University of Michigan&apos;s flagship hackathon,
                    bringing together the brightest student minds from across the country.
                    Over 24 hours, you&apos;ll collaborate, create, and compete for over
                    $40,000 in prizes.
                </p>

                <p
                    className="font-red-hat mt-4 max-w-xl text-[24px] leading-7 text-center"
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
