"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/admin/reservations", label: "Window" },
  { href: "/admin/reservations/tables", label: "Tables" },
  { href: "/admin/reservations/assignments", label: "Assignments" },
  { href: "/admin/reservations/audit", label: "Audit" },
];

export function ReservationNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Reservation"
      className="mt-3 flex flex-wrap items-center gap-1"
    >
      {LINKS.map((link) => {
        const active =
          link.href === "/admin/reservations"
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
