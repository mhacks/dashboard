"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  // `forcedTheme` first: the app forces light, but `theme` still reports the
  // stored preference ("system"). Passing that through made Sonner use its
  // dark palette on a dark-mode OS — near-white descriptions on the light
  // --popover background below.
  const { forcedTheme, theme = "system" } = useTheme();

  return (
    <Sonner
      theme={(forcedTheme ?? theme) as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          // Tie the description to the same tokens as the background, like the
          // title already is, so the two can't drift apart again.
          description: "!text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
