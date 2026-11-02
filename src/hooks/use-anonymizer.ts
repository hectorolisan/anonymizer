"use client";

import { useState } from "react";
import { anonymize, AnonymizeError, needsModel, type Category, type MappingItem } from "@/lib/anonymize";
import { DEFAULT_MODEL, extractEntities, hasWebGPU, loadedModel, loadModel } from "@/lib/engine";

export type Phase = "idle" | "loading" | "running";
export type Result = { anonymized: string; mapping: MappingItem[]; ms: number };

const message = (err: unknown) =>
  err instanceof AnonymizeError ? err.message : `Algo falló en el navegador: ${err instanceof Error ? err.message : err}`;

export function useAnonymizer() {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [ready, setReady] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ensureModel() {
    if (loadedModel() === model) return;
    if (!hasWebGPU())
      throw new AnonymizeError(
        "Tu navegador no tiene WebGPU. Usa Chrome o Edge recientes, o desmarca Personas, Empresas y Direcciones (el resto funciona sin modelo).",
      );
    setPhase("loading");
    setProgress(0);
    setReady(null);
    await loadModel(model, (r) => setProgress(r.progress));
    setReady(model);
  }

  async function guard(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(message(err));
    } finally {
      setPhase("idle");
    }
  }

  const load = () => guard(ensureModel);

  const run = (text: string, categories: Category[]) =>
    guard(async () => {
      if (text.trim() && categories.length && needsModel(categories)) await ensureModel();
      setPhase("running");
      const t0 = performance.now();
      const r = await anonymize(text, categories, (part) => extractEntities(model, part));
      setResult({ ...r, ms: performance.now() - t0 });
    });

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { model, setModel, ready, phase, progress, result, error, load, run, reset };
}
