"use client";

import { Check, ChevronDown } from "lucide-react";
import { useRef } from "react";
import type { Phase } from "@/hooks/use-anonymizer";
import { MODELS, modelName } from "@/lib/engine";
import { controlClass } from "./theme-controls";
import { anchorUnder } from "./ui";

type Props = {
  webgpu: boolean;
  model: string;
  ready: string | null;
  phase: Phase;
  progress: number;
  onModel: (id: string) => void;
};

const gb = (mb?: number) => `${((mb ?? 0) / 1024).toFixed(1)} GB`;

export function ModelStatus({ webgpu, model, ready, phase, progress, onModel }: Props) {
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const current = MODELS.find((m) => m.model_id === model);
  const [dot, text] = !webgpu
    ? ["bg-bad", "Sin WebGPU · solo regex"]
    : phase === "loading"
      ? ["bg-warn animate-pulse", `Cargando · ${Math.round(progress * 100)} %`]
      : ready === model
        ? ["bg-good", "Modelo listo"]
        : ["bg-muted-foreground", "Modelo sin cargar"];

  return (
    <div className="flex items-center gap-2">
      <button
        ref={trigger}
        type="button"
        popoverTarget="model-picker"
        aria-label="Modelo"
        aria-haspopup="listbox"
        disabled={!webgpu || phase !== "idle"}
        className={controlClass}
      >
        {modelName(model)}
        <span className="font-mono text-xs text-muted-foreground">{gb(current?.vram_required_MB)}</span>
        <ChevronDown className="ml-1 size-4 text-muted-foreground" aria-hidden />
      </button>
      <div
        ref={list}
        id="model-picker"
        popover="auto"
        role="listbox"
        aria-label="Modelo"
        onBeforeToggle={(e) => e.newState === "open" && anchorUnder(trigger.current, e.currentTarget, "left")}
        className="card absolute inset-auto m-0 w-64 p-1 text-foreground"
      >
        {MODELS.map((m) => (
          <button
            key={m.model_id}
            type="button"
            role="option"
            aria-selected={m.model_id === model}
            onClick={() => {
              onModel(m.model_id);
              list.current?.hidePopover();
            }}
            className="group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none aria-selected:text-primary"
          >
            <span className="font-medium">{modelName(m.model_id)}</span>
            <span className="font-mono text-xs text-muted-foreground">{gb(m.vram_required_MB)}</span>
            <Check className="ml-auto size-4 opacity-0 group-aria-selected:opacity-100" aria-hidden />
          </button>
        ))}
      </div>
      <span
        role="status"
        className="inline-flex h-9 min-w-36 items-center gap-2 rounded-lg border bg-card px-3 text-sm whitespace-nowrap text-muted-foreground tabular-nums"
      >
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        {text}
      </span>
    </div>
  );
}
