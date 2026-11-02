"use client";

import { Check, ChevronDown, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { Phase } from "@/hooks/use-anonymizer";
import { isCached, MODELS, modelName } from "@/lib/engine";
import { controlClass } from "./theme-controls";
import { anchorUnder } from "./ui";

type Props = {
  webgpu: boolean;
  model: string;
  ready: string | null;
  phase: Phase;
  progress: number;
  onModel: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
};

const gb = (mb?: number) => `${((mb ?? 0) / 1024).toFixed(1)} GB`;

export function ModelStatus({ webgpu, model, ready, phase, progress, onModel, onDelete }: Props) {
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [cached, setCached] = useState<Record<string, boolean>>({});
  const current = MODELS.find((m) => m.model_id === model);
  const [dot, text] = !webgpu
    ? ["bg-bad", "Sin WebGPU · solo regex"]
    : phase === "loading"
      ? ["bg-warn animate-pulse", `Cargando · ${Math.round(progress * 100)} %`]
      : ready === model
        ? ["bg-good", "Modelo listo"]
        : ["bg-muted-foreground", "Modelo sin cargar"];

  const refresh = async () =>
    setCached(Object.fromEntries(await Promise.all(MODELS.map(async (m) => [m.model_id, await isCached(m.model_id)]))));

  return (
    <div className="flex items-center gap-2">
      <button
        ref={trigger}
        type="button"
        popoverTarget="model-picker"
        aria-label="Modelo"
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
        role="group"
        aria-label="Modelo"
        onBeforeToggle={(e) => {
          if (e.newState !== "open") return;
          anchorUnder(trigger.current, e.currentTarget, "left");
          void refresh();
        }}
        className="card absolute inset-auto m-0 w-80 p-1 text-foreground"
      >
        {MODELS.map((m) => (
          <div key={m.model_id} className="flex items-center gap-1">
            <button
              type="button"
              aria-pressed={m.model_id === model}
              onClick={() => {
                onModel(m.model_id);
                list.current?.hidePopover();
              }}
              className="group flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none aria-pressed:text-primary"
            >
              <span className="font-medium">{modelName(m.model_id)}</span>
              <span className="font-mono text-xs text-muted-foreground">{gb(m.vram_required_MB)}</span>
              {cached[m.model_id] && <span className="text-xs text-muted-foreground">· descargado</span>}
              <Check className="ml-auto size-4 shrink-0 opacity-0 group-aria-pressed:opacity-100" aria-hidden />
            </button>
            {cached[m.model_id] && (
              <button
                type="button"
                aria-label={`Borrar ${modelName(m.model_id)} de la caché`}
                title="Borrar de la caché"
                onClick={async () => {
                  await onDelete(m.model_id);
                  await refresh();
                }}
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-bad"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        ))}
        <p className="border-t px-2.5 pt-2 pb-1.5 text-xs text-muted-foreground">
          Los modelos se guardan en el navegador. Bórralos para liberar espacio.
        </p>
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
