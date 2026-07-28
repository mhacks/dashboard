import type { Metadata } from "next";
import { HowToMcp } from "./HowToMcp";
import { Footer } from "@/components/landing/sections/Footer";

export const metadata: Metadata = {
  title: "How to MCP · MHacks 2026",
  description:
    "Connect Claude, Codex, or any MCP-capable agent to the MHacks MCP server and apply straight from your terminal.",
};

export default function HowToMcpPage() {
  return (
    <main className="relative">
      <HowToMcp />
      <Footer />
    </main>
  );
}
