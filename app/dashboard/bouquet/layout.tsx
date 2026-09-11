import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import "./bouquet.css";

/* Self-hosted by next/font, so there is no render-blocking request to Google
   and no FOUT on the canvas-rendered text. */
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bouquet Builder · MHacks",
  description:
    "Arrange a bouquet of Michigan wildflowers and take it away as a die-cut sticker.",
};

export default function BouquetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={quicksand.variable}>{children}</div>;
}
