"use client";

import { useEffect, useRef, useState } from "react";
import {
  anonymize,
  AnonymizeError,
  CancelledError,
  needsModel,
  type Anonymized,
  type Category,
  type Lists,
} from "@/lib/anonymize";
import { DEFAULT_MODEL, deleteCached, extractEntities, hasWebGPU, interrupt, loadedModel, loadModel } from "@/lib/engine";

export type Phase = "idle" | "loading" | "running";
export type Result = Anonymized & { ms: number };
export type Chunks = { done: number; total: number };

const message = (err: unknown) =>
  err instanceof AnonymizeError ? err.message : `Algo falló en el navegador: ${err instanceof Error ? err.message : err}`;

export function useAnonymizer() {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [ready, setReady] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [chunks, setChunks] = useState<Chunks | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function ensureModel(id: string) {
    if (loadedModel() === id) return;
    if (!hasWebGPU())
      throw new AnonymizeError(
        "Tu navegador no tiene WebGPU. Usa Chrome o Edge recientes, o desmarca Personas, Empresas y Direcciones (el resto funciona sin modelo).",
      );
    setPhase("loading");
    setProgress(0);
    setReady(null);
    await loadModel(id, (r) => setProgress(r.progress));
    setReady(id);
  }

  // true on success, so the UI can switch to the result view.
  async function guard(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      if (!(err instanceof CancelledError)) setError(message(err));
      return false;
    } finally {
      setPhase("idle");
      setChunks(null);
    }
  }

  // Load the selected model up front so the first anonymisation is fast.
  useEffect(() => {
    if (!hasWebGPU()) return;
    void Promise.resolve().then(() => guard(() => ensureModel(model)));
  }, [model]);

  const run = (text: string, categories: Category[], lists?: Lists) =>
    guard(async () => {
      if (text.trim() && categories.length && needsModel(categories)) await ensureModel(model);
      setPhase("running");
      abort.current = new AbortController();
      const t0 = performance.now();
      const r = await anonymize(text, categories, (part) => extractEntities(model, part), {
        signal: abort.current.signal,
        onChunk: (done, total) => setChunks({ done, total }),
        lists,
      });
      setResult({ ...r, ms: performance.now() - t0 });
    });

  const cancel = () => {
    abort.current?.abort();
    interrupt();
  };

  // Frees disk space; the selected model downloads again on the next run.
  const removeCached = async (id: string) => {
    await deleteCached(id);
    if (loadedModel() !== ready) setReady(null);
  };

  // Manual fixes on the shown result (revert / hide).
  const edit = (fn: (r: Anonymized) => Anonymized) => setResult((r) => r && { ...fn(r), ms: r.ms });

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { model, setModel, ready, phase, progress, chunks, result, error, run, cancel, removeCached, edit, reset };
}
