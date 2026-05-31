import type { ReactNode } from "react";

export function Panel({
  step,
  title,
  hint,
  active,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--color-edge)] bg-[var(--color-panel)] p-6 transition-opacity ${
        active ? "opacity-100" : "opacity-40"
      }`}
    >
      <header className="mb-5 flex items-baseline gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-edge)] text-xs text-[var(--color-mute)]">
          {step}
        </span>
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        {hint && <span className="text-sm text-[var(--color-mute)]">{hint}</span>}
      </header>
      {children}
    </section>
  );
}
