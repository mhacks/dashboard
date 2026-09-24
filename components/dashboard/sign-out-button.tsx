"use client";

import { useState } from "react";

import { logout } from "@/lib/actions/auth.server.actions";

/**
 * Closes the masthead rail. Styled as the console's mono chip rather than the
 * glass pill the apply flow uses — it sits on paper here, not on a photograph.
 *
 * A button rather than a link because signing out is a server action, not a
 * destination.
 */
export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <button
      type="button"
      disabled={isSigningOut}
      onClick={async () => {
        setIsSigningOut(true);
        await logout();
      }}
      className="cursor-pointer rounded-[2px] border border-ui-line-strong bg-ui-paper px-2.5 py-[5px] font-red-hat-mono text-[10px] tracking-[0.14em] whitespace-nowrap text-ui-ink uppercase transition-colors duration-200 hover:bg-ui-selected focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-ink disabled:opacity-50"
    >
      {isSigningOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
