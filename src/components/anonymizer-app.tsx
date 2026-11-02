"use client";

import { FileUp, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useAnonymizer } from "@/hooks/use-anonymizer";
import { CATEGORIES, CATEGORY_LABELS, DEFAULT_CATEGORIES, segments, type Category } from "@/lib/anonymize";
import { hasWebGPU } from "@/lib/engine";
import { ACCEPT, ExtractionError, extractText } from "@/lib/extract";
import { CATEGORY_COLORS, labelClass } from "@/lib/utils";
import { Credit } from "./credit";
import { DeanonymizePanel } from "./deanonymize-panel";
import { MappingTable } from "./mapping-table";
import { ModelStatus } from "./model-status";
import { ThemeControls } from "./theme-controls";
import { CopyButton, NoticeBox, Placeholder, type Notice } from "./ui";

// Server snapshot = optimistic, so the static HTML matches the first client render.
const noop = () => () => {};

export function AnonymizerApp() {
  const client = useSyncExternalStore(noop, () => true, () => false);
  const webgpu = useSyncExternalStore(noop, hasWebGPU, () => true);
  const a = useAnonymizer();
  const [text, setText] = useState("");
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [fileNotice, setFileNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = a.phase !== "idle";

  async function openFile(file?: File) {
    if (!file) return;
    setFileNotice({ kind: "info", text: `Extrayendo texto de “${file.name}”…` });
    try {
      setText(await extractText(file));
      setFileNotice({ kind: "info", text: `Texto extraído de “${file.name}”. Revísalo antes de anonimizar.` });
    } catch (err) {
      setFileNotice(
        err instanceof ExtractionError
          ? { kind: "warn", text: err.message }
          : { kind: "error", text: "Error al procesar el archivo." },
      );
    }
  }

  const toggle = (c: Category) =>
    setCategories((cs) => CATEGORIES.filter((x) => (x === c ? !cs.includes(c) : cs.includes(x))));

  const clear = () => {
    setText("");
    setFileNotice(null);
    a.reset();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Lock className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl">Anonimizador</h1>
              <p className="text-sm text-muted-foreground">Tapa los datos sensibles antes de usar la IA de la nube</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ModelStatus
              webgpu={webgpu}
              model={a.model}
              ready={a.ready}
              phase={a.phase}
              progress={a.progress}
              onModel={a.setModel}
              onLoad={a.load}
            />
            {client && <ThemeControls />}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <p className="flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <ShieldCheck className="size-4" aria-hidden />
          100 % local · El texto y el modelo nunca salen de tu navegador
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card flex flex-col gap-4 p-5" aria-labelledby="input-title">
            <div className="flex items-center justify-between gap-4">
              <h2 id="input-title" className="text-lg">
                Entrada
              </h2>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <FileUp className="size-4" aria-hidden />
                Abrir archivo
              </button>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                hidden
                onChange={(e) => {
                  openFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <textarea
              aria-label="Texto a anonimizar"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                openFile(e.dataTransfer.files[0]);
              }}
              placeholder="Pega aquí tu contrato, email o transcripción… o arrastra un .txt, .md, .docx o .pdf"
              className={`min-h-80 flex-1 resize-y rounded-lg border bg-background p-4 text-sm leading-7 outline-none placeholder:text-muted-foreground focus-visible:border-primary ${dragging ? "border-primary ring-4 ring-primary/20" : ""}`}
            />
            <NoticeBox notice={fileNotice} />

            <fieldset className="space-y-2">
              <legend className={labelClass}>Qué anonimizar</legend>
              <div className="flex flex-wrap gap-2 pt-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={categories.includes(c)}
                    onClick={() => toggle(c)}
                    className="inline-flex h-8 items-center gap-2 rounded-full border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                  >
                    <span
                      className="size-2 rounded-full bg-(--c) ring-1 ring-white/60"
                      style={{ "--c": CATEGORY_COLORS[c] } as CSSProperties}
                      aria-hidden
                    />
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => a.run(text, categories)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                {a.phase === "loading" ? "Descargando modelo…" : a.phase === "running" ? "Anonimizando…" : "Anonimizar"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={clear}
                className="h-10 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                Limpiar
              </button>
            </div>

            {a.phase === "loading" && (
              <div className="space-y-1.5">
                <div
                  role="progressbar"
                  aria-label="Descarga del modelo"
                  aria-valuenow={Math.round(a.progress * 100)}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${a.progress * 100}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Solo la primera vez: el modelo queda en la caché del navegador.
                </p>
              </div>
            )}
            <NoticeBox notice={a.error ? { kind: "error", text: a.error } : null} />
          </section>

          <section className="card flex flex-col gap-4 p-5" aria-labelledby="output-title">
            <div className="flex items-center justify-between gap-4">
              <h2 id="output-title" className="text-lg">
                Resultado anonimizado
              </h2>
              <CopyButton text={a.result?.anonymized ?? ""} />
            </div>

            {a.result ? (
              <>
                <div
                  data-testid="output"
                  className="min-h-80 flex-1 overflow-auto rounded-lg border bg-background p-4 text-sm leading-7 whitespace-pre-wrap"
                >
                  {segments(a.result.anonymized, a.result.mapping).map((s, i) =>
                    typeof s === "string" ? s : <Placeholder key={i} item={s} />,
                  )}
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {a.result.mapping.length
                    ? `${a.result.mapping.length} datos tapados · ${(a.result.ms / 1000).toFixed(1)} s`
                    : "No se detectaron datos sensibles en el texto."}
                </p>
              </>
            ) : (
              <div className="grid min-h-80 flex-1 place-items-center rounded-lg border border-dashed bg-muted/40 p-6 text-center">
                <div>
                  <Lock className="mx-auto size-12 text-primary/50" strokeWidth={1.25} aria-hidden />
                  <p className="mt-4 font-semibold">Aquí verás tu texto limpio</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Los datos sensibles se convertirán en etiquetas de color
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        <MappingTable mapping={a.result?.mapping ?? []} />
        <DeanonymizePanel mapping={a.result?.mapping ?? []} />
      </main>

      <footer className="px-4 py-6">
        <Credit />
      </footer>
    </div>
  );
}
