"use client";

import { Download } from "lucide-react";
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
  onLoad: () => void;
};

export function ModelStatus({ webgpu, model, ready, phase, progress, onModel, onLoad }: Props) {
  const [dot, text] = !webgpu
    ? ["bg-bad", "Sin WebGPU · solo regex"]
    : phase === "loading"
      ? ["bg-warn animate-pulse", `Descargando modelo · ${Math.round(progress * 100)} %`]
      : ready === model
        ? ["bg-good", `Modelo listo · ${modelName(model)}`]
        : ["bg-muted-foreground", "Modelo sin cargar"];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="model">
        Modelo
      </label>
      <select
        id="model"
        value={model}
        disabled={!webgpu || phase !== "idle"}
        onChange={(e) => onModel(e.target.value)}
        className={`${controlClass} pr-2`}
      >
        {MODELS.map((m) => (
          <option key={m.model_id} value={m.model_id}>
            {modelName(m.model_id)} · {((m.vram_required_MB ?? 0) / 1024).toFixed(1)} GB
          </option>
        ))}
      </select>
      <span role="status" className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        {text}
        {webgpu && phase === "idle" && ready !== model && (
          <button
            type="button"
            onClick={onLoad}
            className="-mr-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-muted"
          >
            <Download className="size-3.5" aria-hidden />
            Descargar
          </button>
        )}
      </span>
    </div>
  );
}
