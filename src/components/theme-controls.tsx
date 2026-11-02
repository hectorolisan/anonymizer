"use client";

import { Check, Moon, Palette, Sun } from "lucide-react";
import { useRef, useState } from "react";
import { applyMode, applyPrimary, PRIMARY_COLORS, storedMode, storedPrimary } from "@/lib/theme";

export const controlBase =
  "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";

export const controlClass = `${controlBase} bg-card hover:bg-muted`;

export function ThemeControls() {
  // Lazy init only runs on the client: this component is rendered after mount.
  const [mode, setMode] = useState(storedMode);
  const [primary, setPrimary] = useState(storedPrimary);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        type="button"
        className={controlClass}
        onClick={() => {
          const next = mode === "dark" ? "light" : "dark";
          applyMode(next);
          setMode(next);
        }}
        aria-label={mode === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
      >
        {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>

      <button
        ref={trigger}
        type="button"
        className={controlClass}
        popoverTarget="primary-picker"
        aria-label="Color primario"
      >
        <Palette className="size-4" />
        <span className="size-3 rounded-full bg-primary" />
      </button>
      <div
        id="primary-picker"
        popover="auto"
        // Anchor under the trigger, right-aligned; absolute so it scrolls with the page.
        onBeforeToggle={(e) => {
          const r = trigger.current?.getBoundingClientRect();
          if (e.newState !== "open" || !r) return;
          const s = e.currentTarget.style;
          s.top = `${r.bottom + window.scrollY + 8}px`;
          s.right = `${document.documentElement.clientWidth - r.right}px`;
        }}
        className="card absolute inset-auto m-0 w-56 p-3 text-foreground"
      >
        <p className="mb-2 text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">Color primario</p>
        <div role="radiogroup" aria-label="Color primario" className="grid grid-cols-6 gap-2">
          {PRIMARY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === primary}
              aria-label={c}
              title={c}
              onClick={() => {
                applyPrimary(c);
                setPrimary(c);
              }}
              style={{ background: `var(--color-${c}-500)` }}
              className="grid size-7 place-items-center rounded-full text-white ring-offset-2 ring-offset-card focus-visible:outline-2 focus-visible:outline-foreground aria-checked:ring-2 aria-checked:ring-foreground"
            >
              {c === primary && <Check className="size-3.5" />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
