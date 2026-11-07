// Small shared form/admin building blocks.

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`flex flex-col gap-3 rounded-2xl bg-white p-3.5 ${className}`}>{children}</section>;
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "h-11 w-full min-w-0 rounded-[10px] border border-[#d8dce3] bg-white px-3 text-[15px]";

export function Button({ children, variant = "navy", className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "navy" | "gold" | "ghost" | "danger" }) {
  const v = {
    navy: "bg-navy text-white",
    gold: "bg-gold text-navy",
    ghost: "border border-[#d8dce3] bg-white text-navy",
    danger: "border border-[#f2b8c2] bg-[#fcebee] text-[#8e0b20]",
  }[variant];
  return (
    <button {...rest} className={`h-12 rounded-xl px-4 text-[15px] font-bold disabled:opacity-50 ${v} ${className}`}>
      {children}
    </button>
  );
}

export function Pill({ tone, children }: { tone: "green" | "red" | "gold" | "grey"; children: React.ReactNode }) {
  const t = {
    green: "bg-[#e3f4ea] text-[#17643a]",
    red: "bg-[#fcebee] text-[#8e0b20]",
    gold: "bg-gold-soft text-[#6b550f]",
    grey: "bg-[#edeae3] text-[#3a4352]",
  }[tone];
  return <span className={`rounded-full px-2 py-1 text-[11px] font-bold whitespace-nowrap ${t}`}>{children}</span>;
}

export function Flash({ tone = "green", children }: { tone?: "green" | "red"; children: React.ReactNode }) {
  return (
    <p role={tone === "red" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${tone === "red" ? "bg-[#fcebee] text-[#8e0b20]" : "bg-[#e3f4ea] text-[#17643a]"}`}>
      {children}
    </p>
  );
}
