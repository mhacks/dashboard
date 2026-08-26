"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReservationEventNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const overviewHref = `/admin/reservations/${eventId}`;
  const links = [
    { href: overviewHref, label: "Overview" },
    { href: `${overviewHref}/tables`, label: "Tables" },
    { href: `${overviewHref}/assignments`, label: "Assignments" },
    { href: `${overviewHref}/audit`, label: "Audit" },
  ];

  return (
    <nav
      aria-label="Event workspace"
      className="mt-3 flex flex-wrap items-center gap-1"
    >
      {links.map((link) => {
        const active =
          link.href === overviewHref
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Button
            key={link.href}
            asChild
            variant={active ? "secondary" : "ghost"}
            size="sm"
          >
            <Link href={link.href} aria-current={active ? "page" : undefined}>
              {link.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
