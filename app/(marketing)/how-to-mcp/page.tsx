import type { Metadata } from "next";
import { HowToMcp } from "./HowToMcp";
import { Footer } from "@/components/landing/sections/Footer";
import { EVENT } from "@/lib/config/event";

export const metadata: Metadata = {
  title: `How to MCP · ${EVENT.fullName}`,
  description: `Connect Claude, Codex, or any MCP-capable agent to the ${EVENT.name} MCP server and apply straight from your terminal.`,
};

export default function HowToMcpPage() {
  return (
    <main className="relative bg-transparent">
      <HowToMcp />
      <Footer variant="compact" />
    </main>
  );
}
