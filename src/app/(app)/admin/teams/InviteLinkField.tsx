"use client";

import { Field, inputCls } from "@/components/ui";

/**
 * Display an invite link in a read‑only input with a copy button.
 * Extracted into a client component so the event handlers (onClick) don't
 * cause SSR serialisation errors in Next.js 15.
 */
export function InviteLinkField({ url, base }: { url: string; base: string }) {
  return (
    <Field label="Invite link — copy and send on WhatsApp">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className={`${inputCls} flex-1 cursor-pointer select-all text-[13px] font-mono`}
          onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
        />
        <button
          type="button"
          className="h-11 w-11 shrink-0 rounded-xl border border-[#d8dce3] bg-white text-navy text-xs font-bold"
          onClick={(e) => {
            navigator.clipboard.writeText(url);
            const btn = e.currentTarget as HTMLButtonElement;
            const orig = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => {
              btn.textContent = orig;
            }, 1500);
          }}
        >
          Copy
        </button>
      </div>
    </Field>
  );
}