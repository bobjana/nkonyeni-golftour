"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Event" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/reveal", label: "Reveal" },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="grid grid-cols-4 gap-1.5">
      {TABS.map((t) => {
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
