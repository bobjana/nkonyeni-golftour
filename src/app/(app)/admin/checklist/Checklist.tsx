"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ChecklistSection } from "@/lib/checklist";

const storeKey = (eventId: string) => `golftour:checklist:${eventId}`;

/**
 * The organizer's time-stamped checklist. Items whose time has passed are
 * struck through automatically (no checkbox); items still ahead can be ticked,
 * and the ticks persist in localStorage on this device.
 */
export function Checklist({ eventId, sections }: { eventId: string; sections: ChecklistSection[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem(storeKey(eventId)) ?? "{}"));
    } catch {}
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [eventId]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(storeKey(eventId), JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">Items are struck through once their time passes. Tick the ones that are still ahead.</p>
      {sections.map((s) => (
        <section key={s.id} className="flex flex-col gap-1 rounded-2xl bg-white p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-navy">{s.title}</h2>
            {s.subtitle && <span className="shrink-0 text-xs text-muted">{s.subtitle}</span>}
          </div>
          <ul className="flex flex-col">
            {s.items.map((item) => {
              const due = item.at ? new Date(`${item.at.date}T${item.at.time}:00`).getTime() : null;
              const passed = due !== null && now >= due;
              const done = checked[item.id] === true || passed;
              return (
                <li key={item.id} className="flex items-center gap-3 border-t border-[#f0ede6] py-2.5 first:border-0">
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    disabled={passed}
                    aria-pressed={done}
                    aria-label={`${item.label}${done ? " — done" : ""}`}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition-colors ${
                      done ? "border-gold bg-gold text-navy" : "border-[#d8dce3] bg-white text-transparent"
                    } ${passed ? "opacity-40" : ""}`}
                  >
                    ✓
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    {item.href ? (
                      <Link href={item.href} className={`truncate text-sm font-semibold ${done ? "text-muted line-through" : "text-navy"}`}>
                        {item.label}
                      </Link>
                    ) : (
                      <span className={`truncate text-sm font-semibold ${done ? "text-muted line-through" : "text-navy"}`}>{item.label}</span>
                    )}
                    {item.note && <span className="text-[11px] text-muted">{item.note}</span>}
                  </div>
                  {item.at && (
                    <span className={`shrink-0 text-[11px] font-semibold ${passed && !checked[item.id] ? "text-[#b45309]" : "text-muted"}`}>
                      {item.at.time}
                      {passed && !checked[item.id] ? " · past" : ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
