"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Event" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/reveal", label: "Approve" },
  { href: "/admin/demo", label: "Demo" },
];

export function AdminTabs({ demo }: { demo: boolean }) {
  const path = usePathname();
  const tabs = demo ? TABS : TABS.filter((t) => t.href !== "/admin/demo");
  return (
    <nav className={`grid gap-1.5 ${demo ? "grid-cols-5" : "grid-cols-4"}`}>
      {tabs.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" || path.startsWith("/admin/sessions") : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-[10px] py-2 text-center text-xs ${active ? "bg-gold font-bold text-navy" : "bg-white/10 font-semibold text-white"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
