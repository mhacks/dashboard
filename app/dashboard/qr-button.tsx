"use client";

import type { ReactNode } from "react";

import { KeepAwake } from "@/components/checkin/keep-awake";
import { buttonClass, Caret } from "@/components/console/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

/**
 * The dashboard's "show my code" button.
 *
 * Deliberately thin: the QR is rendered on the server and handed in as
 * `children`, so the only thing this component's JavaScript does is decide
 * whether the sheet is open. The encoded code travels with the page payload,
 * so opening the sheet costs no request — which matters on a phone that has
 * already lost the venue wifi by the time it reaches the front of the queue.
 *
 * The sheet still needs this chunk to open at all, which is why the panel also
 * links to /dashboard/qr: that one is plain server-rendered HTML and works
 * even when no JavaScript arrives.
 *
 * A bottom sheet rather than a side panel because the audience is entirely on
 * phones and the code is square — and because vaul's drag-to-dismiss is the
 * right gesture for handing your phone to a volunteer and taking it back.
 */
export function QrDrawerButton({ children }: { children: ReactNode }) {
  return (
    <Drawer>
      <DrawerTrigger className={buttonClass("primary")}>
        <Caret />
        Show check-in code
      </DrawerTrigger>

      {/* bg-white, not the inherited bg-popover: the console sheet paints a
          dot screen and scanlines, and that texture bleeding into the code's
          quiet zone measurably costs scan rate. */}
      <DrawerContent className="border-ui-line bg-white text-ui-ink">
        <KeepAwake />

        <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-4 px-5 pt-2 pb-7">
          <div className="text-center">
            <DrawerTitle className="font-red-hat-mono text-[13px] tracking-[0.18em] text-ui-ink uppercase">
              Check-in code
            </DrawerTitle>
            <DrawerDescription className="mt-1.5 text-[13px] leading-[1.5] text-ui-ink-soft">
              Show this to an organizer at the door and at meals. Turn your
              brightness up so it scans cleanly.
            </DrawerDescription>
          </div>

          {children}

          <DrawerClose className={buttonClass("outline", "w-full")}>
            Done
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
