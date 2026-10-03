"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/admin/teams", label: "Teams", exact: true },
  { href: "/admin/teams/reservations", label: "Windows", exact: true },
  { href: "/admin/teams/reservations/tables", label: "Tables", exact: false },
  {
    href: "/admin/teams/reservations/assignments",
    label: "Assignments",
    exact: false,
  },
  { href: "/admin/teams/reservations/audit", label: "Audit", exact: false },
  { href: "/admin/teams/judging", label: "Judging", exact: false },
];

export function TeamsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Teams and reservations"
      className="mt-3 flex flex-wrap items-center gap-1"
    >
      {LINKS.map((link) => {
        const active = link.exact
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
