import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Instrument_Sans,
  Instrument_Serif,
  Red_Hat_Display,
  Red_Hat_Mono,
} from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthStateSync } from "@/components/auth-state-sync";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const redHatDisplay = Red_Hat_Display({
  variable: "--font-red-hat-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const redHatMono = Red_Hat_Mono({
  variable: "--font-red-hat-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mhacks.org"),
  title: "MHacks 2026 · Digital Garden",
  description:
    "MHacks is the University of Michigan's flagship hackathon. 24 hours of building at the intersection of nature and technology. Ann Arbor, Fall 2026.",
  openGraph: {
    title: "MHacks 2026 · Digital Garden",
    description:
      "The University of Michigan's flagship hackathon. Build something that grows.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#3A4A26",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <meta name="apple-mobile-web-app-title" content="MHacks" />
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${instrumentSans.variable} ${redHatDisplay.variable} ${redHatMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <TooltipProvider>
            <AuthStateSync />
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
