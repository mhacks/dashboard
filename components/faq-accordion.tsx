"use client";

import { useState } from "react";

const faqs = [
  {
    q: "What is MHacks?",
    a: "MHacks is the University of Michigan's premier student-run hackathon, held annually in Ann Arbor. It brings together hundreds of students from across the country for a weekend of building, learning, and competing.",
  },
  {
    q: "Who can attend?",
    a: "MHacks is open to all currently enrolled undergraduate and graduate students. Students of all skill levels and disciplines are welcome — no prior hackathon experience required.",
  },
  {
    q: "Where is MHacks?",
    a: "MHacks is held on the University of Michigan's campus in Ann Arbor, Michigan. Venue details will be shared with registered participants closer to the event date.",
  },
  {
    q: "Are there travel reimbursements?",
    a: "We offer travel reimbursements on a limited basis for participants traveling from outside the Ann Arbor area. Apply during registration and we'll follow up with details.",
  },
  {
    q: "How much does MHacks cost?",
    a: "MHacks is completely free to attend. We cover meals, snacks, and event resources throughout the entire 36-hour event, thanks to our generous sponsors.",
  },
  {
    q: "How do teams work?",
    a: "Teams can have 1–4 members. You can form a team before the event or find teammates at our team formation session at the start of the hackathon.",
  },
  {
    q: "What are the tracks and prizes?",
    a: "We have four tracks: AI, Sustainability, Healthcare, and Fintech. Each track has dedicated prizes and mentors, plus an overall grand prize awarded to the best project across all tracks.",
  },
  {
    q: "What if this is my first hackathon?",
    a: "First-timers are absolutely welcome. We'll have intro workshops, beginner-friendly resources, and dedicated mentors to help you build something great regardless of your experience level.",
  },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="divide-y divide-zinc-100">
      {faqs.map((faq, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between py-4 text-left transition-colors hover:text-zinc-600"
          >
            <span className="text-[17px] font-medium text-zinc-800">
              {faq.q}
            </span>
            <span className="ml-4 flex-shrink-0 text-lg font-light text-zinc-400 transition-transform duration-200">
              {open === i ? "−" : "+"}
            </span>
          </button>
          <div
            className={`overflow-hidden transition-all duration-200 ${open === i ? "max-h-48 pb-4" : "max-h-0"}`}
          >
            <p className="text-[13px] leading-6 text-zinc-500">{faq.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
