"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlagIcon, GearIcon, PulseIcon, TrophyIcon, UserIcon } from "./icons";

export function BottomNav({ organizer }: { organizer: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/live", label: "Live", Icon: PulseIcon },
    { href: "/matches", label: "Matches", Icon: FlagIcon },
    { href: "/standings", label: "Standings", Icon: TrophyIcon },
    organizer ? { href: "/admin", label: "Organize", Icon: GearIcon } : { href: "/me", label: "Me", Icon: UserIcon },
  ];
  return (
    <nav className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      {items.map(({ href, label, Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? "font-bold text-navy" : "text-muted"}`}
          >
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
