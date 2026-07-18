import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { ADMIN_AREAS } from "@/lib/admin/sections";
import { AdminPageHeader } from "./components/admin-page-header";
import { AdminPageShell } from "./components/admin-page-shell";

export default function AdminHomePage() {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Admin"
        description="Jump into organizer tools below."
      />

      <div className="flex flex-col gap-5">
        {ADMIN_AREAS.map((area) => (
          <section
            key={area.title}
            className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10"
          >
            <div className="flex items-start gap-3 border-b border-foreground/8 px-5 py-4">
              <div className="rounded-xl border border-moss/10 bg-moss/5 p-2.5 text-moss dark:border-sage/15 dark:bg-sage/10 dark:text-sage">
                <area.icon className="size-5" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 className="font-heading text-2xl italic tracking-tight text-moss dark:text-sage">
                  {area.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {area.description}
                </p>
              </div>
            </div>

            <nav className="divide-y divide-foreground/8">
              {area.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-moss/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset dark:hover:bg-sage/[0.05]"
                >
                  <div className="rounded-lg border border-foreground/8 bg-background p-2 text-muted-foreground transition-colors group-hover:border-moss/15 group-hover:text-moss dark:group-hover:border-sage/20 dark:group-hover:text-sage">
                    <link.icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{link.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-moss dark:group-hover:text-sage" />
                </Link>
              ))}
            </nav>
          </section>
        ))}
      </div>
    </AdminPageShell>
  );
}
