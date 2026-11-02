"use client";

import { Loader2, Play } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { anonymize, type Entities } from "@/lib/anonymize";
import { extractEntities, hasWebGPU, loadModel, MODELS, modelName } from "@/lib/engine";
import { extractText } from "@/lib/extract";
import { labelClass } from "@/lib/utils";

type Row = { model: string; file: string; found: Record<keyof Entities, string>; missing: string[]; ms: number };

const KEYS: (keyof Entities)[] = ["personas", "empresas", "direcciones"];
const noop = () => () => {};

// Runs every model over the `pnpm test-files` samples and checks each expected value is gone from the output.
export function Benchmark() {
  const [files, setFiles] = useState<File[]>([]);
  const [models, setModels] = useState(MODELS.map((m) => m.model_id));
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const webgpu = useSyncExternalStore(noop, hasWebGPU, () => true);

  async function run() {
    setRows([]);
    setError(null);
    try {
      const truthFile = files.find((f) => f.name === "muestra.esperado.json");
      if (!truthFile) throw new Error("Falta muestra.esperado.json (pnpm test-files).");
      const truth: Record<string, Entities> = JSON.parse(await truthFile.text());
      const samples = files.filter((f) => truth[f.name]);
      for (const model of models) {
        await loadModel(model, (r) => setStatus(`${modelName(model)} · cargando ${Math.round(r.progress * 100)} %`));
        for (const file of samples) {
          setStatus(`${modelName(model)} · ${file.name}`);
          const t0 = performance.now();
          const { anonymized } = await anonymize(await extractText(file), ["PERSONA", "EMPRESA", "DIRECCION"], (part) =>
            extractEntities(model, part),
          );
          const expected = truth[file.name];
          const missing = KEYS.flatMap((k) => expected[k].filter((v) => anonymized.includes(v)));
          const found = Object.fromEntries(
            KEYS.map((k) => [k, `${expected[k].filter((v) => !anonymized.includes(v)).length}/${expected[k].length}`]),
          ) as Row["found"];
          setRows((r) => [...r, { model, file: file.name, found, missing, ms: performance.now() - t0 }]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl">Benchmark de modelos</h1>
      <p className="text-sm text-muted-foreground">
        Genera los archivos con <code className="font-mono">pnpm test-files</code> y selecciona los{" "}
        <code className="font-mono">muestra.*</code> junto a <code className="font-mono">muestra.esperado.json</code>.
        Un modelo vale si encuentra todas las personas, empresas y direcciones.
      </p>
      <section className="card flex flex-wrap items-center gap-4 px-5 py-4">
        <input
          type="file"
          multiple
          aria-label="Archivos de muestra"
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
          className="text-sm"
        />
        <fieldset className="flex flex-wrap gap-3">
          <legend className="sr-only">Modelos</legend>
          {MODELS.map((m) => (
            <label key={m.model_id} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={models.includes(m.model_id)}
                onChange={(e) =>
                  setModels((l) => (e.target.checked ? [...l, m.model_id] : l.filter((x) => x !== m.model_id)))
                }
                className="accent-primary"
              />
              {modelName(m.model_id)}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          disabled={!!status || !files.length || !models.length || !webgpu}
          onClick={run}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {status ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {status ?? "Ejecutar"}
        </button>
      </section>
      {error && (
        <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
      {rows.length > 0 && (
        <section className="card overflow-x-auto px-5 py-4">
          <h2 className={labelClass}>Resultados</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Modelo</th>
                <th className="py-2 pr-4">Archivo</th>
                {KEYS.map((k) => (
                  <th key={k} className="py-2 pr-4 capitalize">
                    {k}
                  </th>
                ))}
                <th className="py-2 pr-4">Tiempo</th>
                <th className="py-2">Sin tapar</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={`${r.model}-${r.file}`} className={r.missing.length ? "text-bad" : ""}>
                  <td className="py-2 pr-4 font-medium">{modelName(r.model)}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.file}</td>
                  {KEYS.map((k) => (
                    <td key={k} className="py-2 pr-4 font-mono">
                      {r.found[k]}
                    </td>
                  ))}
                  <td className="py-2 pr-4 font-mono">{(r.ms / 1000).toFixed(1)} s</td>
                  <td className="py-2 text-xs">{r.missing.join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
