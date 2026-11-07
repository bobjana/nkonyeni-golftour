"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ token, email, name, team }: { token?: string; email?: string; name?: string; team?: { name: string; color: string } }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-[20px] bg-white p-5.5 text-navy">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{name ? `Welcome, ${name.split(" ")[0]}` : "Sign in"}</h1>
        <p className="text-sm leading-relaxed text-muted">
          {team ? (
            <>You&apos;ve been invited to play for <b style={{ color: team.color }}>{team.name}</b>. </>
          ) : null}
          Enter the event password from your organizer.
        </p>
      </div>
      {token && <input type="hidden" name="token" value={token} />}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">{token ? "Email (from your invite)" : "Email"}</span>
        <input
          name="email"
          type="email"
          required={!token}
          readOnly={!!token}
          defaultValue={email}
          autoComplete="email"
          className="h-12 rounded-xl border border-[#d8dce3] px-3.5 text-base read-only:bg-sand read-only:text-[#3a4352]"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Event password</span>
        <input name="password" type="password" required autoComplete="current-password" className="h-12 rounded-xl border-2 border-navy px-3.5 text-base" />
      </label>
      {state.error && <p role="alert" className="rounded-lg bg-[#fcebee] px-3 py-2 text-sm text-[#8e0b20]">{state.error}</p>}
      <button type="submit" disabled={pending} className="h-13 rounded-2xl bg-gold text-base font-bold text-navy disabled:opacity-60">
        {pending ? "Checking…" : "Enter the tour"}
      </button>
      <p className="text-xs text-muted">You&apos;ll stay signed in on this phone. Add to Home Screen for one-tap access.</p>
    </form>
  );
}
