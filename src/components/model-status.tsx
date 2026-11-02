"use client";

import { ChevronDown } from "lucide-react";
import type { Phase } from "@/hooks/use-anonymizer";
import { MODELS, modelName } from "@/lib/engine";
import { controlClass } from "./theme-controls";

type Props = {
  webgpu: boolean;
  model: string;
  ready: string | null;
  phase: Phase;
  progress: number;
  onModel: (id: string) => void;
};

export function ModelStatus({ webgpu, model, ready, phase, progress, onModel }: Props) {
  const [dot, text] = !webgpu
    ? ["bg-bad", "Sin WebGPU · solo regex"]
    : phase === "loading"
      ? ["bg-warn animate-pulse", `Cargando · ${Math.round(progress * 100)} %`]
      : ready === model
        ? ["bg-good", "Modelo listo"]
        : ["bg-muted-foreground", "Modelo sin cargar"];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <label className="sr-only" htmlFor="model">
          Modelo
        </label>
        <select
          id="model"
          value={model}
          disabled={!webgpu || phase !== "idle"}
          onChange={(e) => onModel(e.target.value)}
          className={`${controlClass} appearance-none pr-9`}
        >
          {MODELS.map((m) => (
            <option key={m.model_id} value={m.model_id}>
              {modelName(m.model_id)} · {((m.vram_required_MB ?? 0) / 1024).toFixed(1)} GB
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
      <span role="status" className="inline-flex h-9 min-w-36 items-center gap-2 rounded-lg border bg-card px-3 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        {text}
      </span>
    </div>
  );
}
