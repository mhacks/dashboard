"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SERVER_URL } from "@/app/(marketing)/how-to-mcp/content";

type Line =
  | { kind: "user"; text: string }
  | { kind: "tool"; text: string }
  | { kind: "agent"; text: string }
  | { kind: "prompt" };

const LINES: Line[] = [
  { kind: "user", text: "help me apply to MHacks" },
  { kind: "tool", text: "mhacks · get_application_schema" },
  { kind: "tool", text: "mhacks · save_application_draft" },
  {
    kind: "agent",
    text: "Draft saved. I still need your school and t-shirt size. Then we can review the MLH terms together before submitting.",
  },
  { kind: "prompt" },
];

function TerminalLine({ line }: { line: Line }) {
  if (line.kind === "user" || line.kind === "prompt") {
    return (
      <p className="flex gap-2">
        <span className="text-moss-300">❯</span>
        <span className="text-[#ebe4ce]">
          {line.kind === "user" ? line.text : null}
          {line.kind === "prompt" && (
            <span
              aria-hidden
              className="type-caret ml-0.5 inline-block h-[1.1em] w-[7px] translate-y-[0.2em] bg-moss-300"
            />
          )}
        </span>
      </p>
    );
  }
  if (line.kind === "tool") {
    return (
      <p className="flex gap-2 text-[#ebe4ce]/55">
        <span className="text-moss-300">✳</span>
        <span>
          {line.text} … <span className="text-moss-300">ok</span>
        </span>
      </p>
    );
  }
  return <p className="pl-5 text-[#ebe4ce]">{line.text}</p>;
}

/** Faux agent session showing the MCP apply flow — the dark terminal card
    used on the home Agent section and the How to MCP page hero. */
export function AgentTerminal({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#ebe4ce]/15 bg-[#1c2513] shadow-[0_32px_80px_-32px_rgba(29,36,18,0.65)] ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 border-b border-[#ebe4ce]/10 px-4 py-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#ebe4ce]/20" />
        ))}
        <span className="ml-2 font-mono text-[11px] tracking-[0.12em] text-[#ebe4ce]/45">
          agent · {SERVER_URL.replace("https://", "")}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-4 font-mono text-[12px] leading-relaxed sm:px-5 sm:text-[13px]">
        {LINES.map((line, i) => (
          <motion.div
            key={i}
            initial={reduced ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{
              duration: 0.4,
              delay: 0.3 + i * 0.45,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <TerminalLine line={line} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
