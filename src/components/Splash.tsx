import type { TeamRow } from "@/lib/db/types";

/** Navy brand frame used by the sign-in screens. */
export function Splash({ subtitle, teams, children }: { subtitle?: string; teams?: TeamRow[]; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col gap-7 bg-navy px-6 pt-14 pb-8 text-white">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-22 w-22 items-center justify-center rounded-full border-[3px] border-gold">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 21V3" />
            <path d="M7 3l10 4-10 4" />
            <ellipse cx="12" cy="21" rx="8" ry="1.5" />
          </svg>
        </div>
        <div className="font-display text-3xl leading-[1.05] font-bold tracking-[3px] text-gold">
          NKONYENI
          <br />
          GOLF TOUR
        </div>
        {subtitle && <div className="text-sm text-mist">{subtitle}</div>}
      </div>
      {teams && teams.length === 2 && (
        <div className="flex items-center justify-center gap-2.5">
          <span className="rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: teams[0].color }}>{teams[0].name}</span>
          <span className="font-display text-lg font-bold text-gold">VS</span>
          <span className="rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: teams[1].color }}>{teams[1].name}</span>
        </div>
      )}
      {children}
    </main>
  );
}
