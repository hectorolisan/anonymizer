"use client";

import { Info } from "lucide-react";
import { useRef } from "react";
import { FORMATS, MAX_MB } from "@/lib/extract";
import { labelClass } from "@/lib/utils";
import { anchorUnder } from "./ui";

export function FileInfo() {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        popoverTarget="file-info"
        aria-label="Archivos aceptados"
        title="Archivos aceptados"
        className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      <div
        id="file-info"
        popover="auto"
        onBeforeToggle={(e) => e.newState === "open" && anchorUnder(trigger.current, e.currentTarget, "right")}
        className="card absolute inset-auto m-0 w-72 p-4 text-sm text-foreground"
      >
        <p className={labelClass}>Archivos aceptados</p>
        <dl className="mt-3 space-y-2">
          {FORMATS.map((f) => (
            <div key={f.ext} className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-xs font-medium whitespace-nowrap">{f.ext}</dt>
              <dd className="text-right text-xs text-muted-foreground">{f.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          Máximo <span className="font-medium text-foreground">{MAX_MB} MB</span>. No salen de tu navegador.
        </p>
      </div>
    </>
  );
}
