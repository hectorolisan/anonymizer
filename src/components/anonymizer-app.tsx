"use client";

import { Check, FileUp, Loader2, Lock } from "lucide-react";
import { useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useAnonymizer } from "@/hooks/use-anonymizer";
import { CATEGORIES, CATEGORY_LABELS, DEFAULT_CATEGORIES, segments, type Category } from "@/lib/anonymize";
import { hasWebGPU } from "@/lib/engine";
import { ACCEPT, ExtractionError, extractText } from "@/lib/extract";
import { CATEGORY_COLORS, labelClass } from "@/lib/utils";
import { Credit } from "./credit";
import { MappingTable } from "./mapping-table";
import { ModelStatus } from "./model-status";
import { ThemeControls } from "./theme-controls";
import { CopyButton, NoticeBox, Placeholder, type Notice } from "./ui";

// Server snapshot = optimistic, so the static HTML matches the first client render.
const noop = () => () => {};

const paneHeader = "flex h-12 items-center justify-between gap-4 px-5";
const paneBody = "min-h-96 flex-1 px-5 pb-5 text-sm leading-7";

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
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
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

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6 sm:px-6">
        <div className="card overflow-hidden">
          <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <section
              aria-label="Original"
              className={`flex flex-col transition-colors ${dragging ? "bg-primary/5 ring-2 ring-primary ring-inset" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                openFile(e.dataTransfer.files[0]);
              }}
            >
              <div className={paneHeader}>
                <h2 className={labelClass}>Original</h2>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <FileUp className="size-3.5" aria-hidden />
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
                placeholder="Pega un contrato, un email o una transcripción, o suelta aquí un .txt, .md, .docx o .pdf."
                className={`${paneBody} resize-none bg-transparent outline-none placeholder:text-muted-foreground`}
              />
            </section>

            <section aria-label="Anonimizado" className="flex flex-col bg-muted/30">
              <div className={paneHeader}>
                <h2 className={labelClass}>Anonimizado</h2>
                <div className="flex items-center gap-3">
                  {a.result && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {a.result.mapping.length} datos · {(a.result.ms / 1000).toFixed(1)} s
                    </span>
                  )}
                  <CopyButton text={a.result?.anonymized ?? ""} />
                </div>
              </div>
              <div data-testid="output" className={`${paneBody} overflow-auto whitespace-pre-wrap`}>
                {a.result ? (
                  a.result.mapping.length ? (
                    segments(a.result.anonymized, a.result.mapping).map((s, i) =>
                      typeof s === "string" ? s : <Placeholder key={i} item={s} />,
                    )
                  ) : (
                    <span className="text-muted-foreground">No se detectaron datos sensibles en el texto.</span>
                  )
                ) : (
                  <span className="text-muted-foreground">
                    Aquí aparecerá el texto con cada dato sensible sustituido por una etiqueta de color.
                  </span>
                )}
              </div>
            </section>
          </div>

          {a.phase === "loading" && (
            <div
              role="progressbar"
              aria-label="Descarga del modelo"
              aria-valuenow={Math.round(a.progress * 100)}
              className="h-0.5 bg-muted"
            >
              <div className="h-full bg-primary transition-[width]" style={{ width: `${a.progress * 100}%` }} />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t px-5 py-4">
            <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
              <legend className="sr-only">Qué anonimizar</legend>
              {CATEGORIES.map((c) => (
                <label
                  key={c}
                  className="group inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors select-none hover:text-foreground has-checked:text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={categories.includes(c)}
                    onChange={() => toggle(c)}
                    className="peer sr-only"
                  />
                  <span
                    style={{ "--c": CATEGORY_COLORS[c] } as CSSProperties}
                    className="grid size-4 place-items-center rounded-[5px] border border-muted-foreground/40 text-white transition-colors group-has-checked:border-(--c) group-has-checked:bg-(--c) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
                    aria-hidden
                  >
                    <Check className="size-3 opacity-0 group-has-checked:opacity-100" strokeWidth={3} />
                  </span>
                  {CATEGORY_LABELS[c]}
                </label>
              ))}
            </fieldset>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={clear}
                className="h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                Limpiar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => a.run(text, categories)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {a.phase === "loading"
                  ? `Descargando modelo · ${Math.round(a.progress * 100)} %`
                  : a.phase === "running"
                    ? "Anonimizando…"
                    : "Anonimizar"}
              </button>
            </div>
          </div>
        </div>

        <NoticeBox notice={fileNotice} />
        <NoticeBox notice={a.error ? { kind: "error", text: a.error } : null} />
        {a.result && a.result.mapping.length > 0 && <MappingTable mapping={a.result.mapping} />}
      </main>

      <footer className="px-4 py-6">
        <Credit />
      </footer>
    </div>
  );
}
