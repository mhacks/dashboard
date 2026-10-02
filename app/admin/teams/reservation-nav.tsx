"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/teams/reservations", label: "Reservations" },
  { href: "/admin/teams/reservations/tables", label: "Tables" },
  { href: "/admin/teams/reservations/assignments", label: "Assignments" },
  { href: "/admin/teams/reservations/audit", label: "Audit" },
];

export function ReservationNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Teams and reservations"
      className="mt-3 flex flex-wrap items-center gap-1"
    >
      {LINKS.map((link) => {
        const active =
          link.href === "/admin/teams" ||
          link.href === "/admin/teams/reservations"
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
