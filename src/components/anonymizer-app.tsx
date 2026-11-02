"use client";

import { ArrowLeft, FileUp, Loader2, Lock } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import logo from "@/assets/logo.svg";
import { useAnonymizer } from "@/hooks/use-anonymizer";
import { DEFAULT_CATEGORIES, segments, type Category } from "@/lib/anonymize";
import { hasWebGPU } from "@/lib/engine";
import { ACCEPT, ExtractionError, extractText } from "@/lib/extract";
import { labelClass } from "@/lib/utils";
import { CategoryFilter } from "./category-filter";
import { Credit } from "./credit";
import { DownloadMenu } from "./download-menu";
import { FileInfo } from "./file-info";
import { MappingTable } from "./mapping-table";
import { ModelStatus } from "./model-status";
import { RestorePanel } from "./restore-panel";
import { ThemeControls } from "./theme-controls";
import { CopyButton, NoticeBox, Placeholder, type Notice } from "./ui";

// Server snapshot = optimistic, so the static HTML matches the first client render.
const noop = () => () => {};

const bar = "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t px-5 py-4";
const body = "min-h-64 w-full flex-1 px-5 pb-5 text-sm leading-7";
const primaryBtn =
  "inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60";
const ghostBtn =
  "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60";

export function AnonymizerApp() {
  const client = useSyncExternalStore(noop, () => true, () => false);
  const webgpu = useSyncExternalStore(noop, hasWebGPU, () => true);
  const a = useAnonymizer();
  const [text, setText] = useState("");
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [showResult, setShowResult] = useState(false);
  const [fileNotice, setFileNotice] = useState<Notice | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = a.phase !== "idle";
  const result = showResult ? a.result : null;
  // Model download, then one step per chunk the model reads.
  const fraction = a.phase === "loading" ? a.progress : a.chunks ? a.chunks.done / a.chunks.total : null;

  // The mapping only lives in this tab: warn before closing it.
  useEffect(() => {
    if (!a.result) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [a.result]);

  async function openFile(file?: File) {
    if (!file) return;
    setFileNotice({ kind: "info", text: `Extrayendo texto de “${file.name}”…` });
    try {
      setText(await extractText(file));
      setFileName(file.name.replace(/\.[^.]+$/, ""));
      setFileNotice({ kind: "info", text: `Texto extraído de “${file.name}”. Revísalo antes de anonimizar.` });
    } catch (err) {
      setFileNotice(
        err instanceof ExtractionError
          ? { kind: "warn", text: err.message }
          : { kind: "error", text: "Error al procesar el archivo." },
      );
    }
  }

  async function run() {
    if (await a.run(text, categories)) {
      setFileNotice(null);
      setShowResult(true);
    }
  }

  const clear = () => {
    setText("");
    setFileName(null);
    setFileNotice(null);
    setShowResult(false);
    a.reset();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 md:flex-nowrap">
          <div className="flex min-w-0 items-center gap-3">
            {/* Pixel art: no optimisation (static export) and crisp scaling. */}
            <Image src={logo} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 rounded-lg [image-rendering:pixelated]" />
            <div className="min-w-0">
              <h1 className="text-2xl">Anonimizador</h1>
              <p className="truncate text-sm text-muted-foreground">Oculta datos personales en local</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ModelStatus
              webgpu={webgpu}
              model={a.model}
              ready={a.ready}
              phase={a.phase}
              progress={a.progress}
              onModel={a.setModel}
              onDelete={a.removeCached}
            />
            {client && <ThemeControls />}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        {result ? (
          <section aria-labelledby="result-title" className="card flex flex-1 flex-col overflow-hidden">
            <div className="flex h-12 items-center justify-between gap-4 px-5">
              <h2 id="result-title" className={labelClass}>
                Anonimizado
              </h2>
              <span className="font-mono text-xs text-muted-foreground">
                {result.mapping.length} datos · {(result.ms / 1000).toFixed(1)} s
              </span>
            </div>
            <div data-testid="output" className={`${body} overflow-auto whitespace-pre-wrap`}>
              {result.mapping.length ? (
                segments(result.anonymized, result.mapping).map((s, i) =>
                  typeof s === "string" ? s : <Placeholder key={i} item={s} />,
                )
              ) : (
                <span className="text-muted-foreground">No se detectaron datos sensibles en el texto.</span>
              )}
            </div>
            <div className={bar}>
              <button type="button" onClick={() => setShowResult(false)} className={`${ghostBtn} -ml-3`}>
                <ArrowLeft className="size-4" aria-hidden />
                Editar texto
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={clear} className={ghostBtn}>
                  Nuevo texto
                </button>
                <DownloadMenu
                  text={result.anonymized}
                  base={fileName ? `${fileName}-anonimizado` : "anonimizado"}
                  className={ghostBtn}
                />
                <CopyButton text={result.anonymized} className={primaryBtn} />
              </div>
            </div>
          </section>
        ) : (
          <section
            aria-labelledby="input-title"
            className={`card flex flex-1 flex-col overflow-hidden transition-shadow ${dragging ? "ring-2 ring-primary" : ""}`}
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
            <div className="flex h-12 items-center justify-between gap-4 px-5">
              <h2 id="input-title" className={labelClass}>
                Texto original
              </h2>
              <div className="flex items-center gap-1">
                <FileInfo />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <FileUp className="size-3.5" aria-hidden />
                  Abrir archivo
                </button>
              </div>
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !busy) {
                  e.preventDefault();
                  run();
                }
              }}
              placeholder="Escribe, pega o suelta un documento…"
              className={`${body} resize-none bg-transparent outline-none placeholder:text-muted-foreground`}
            />

            {fraction !== null && (
              <div
                role="progressbar"
                aria-label={a.phase === "loading" ? "Carga del modelo" : "Anonimización"}
                aria-valuenow={Math.round(fraction * 100)}
                className="h-0.5 bg-muted"
              >
                <div className="h-full bg-primary transition-[width]" style={{ width: `${fraction * 100}%` }} />
              </div>
            )}

            <div className={bar}>
              <CategoryFilter value={categories} onChange={setCategories} />
              <div className="ml-auto flex items-center gap-2">
                {a.phase === "running" ? (
                  <button type="button" onClick={a.cancel} className={ghostBtn}>
                    Cancelar
                  </button>
                ) : (
                  <button type="button" disabled={busy || !text} onClick={clear} className={ghostBtn}>
                    Limpiar
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={run}
                  aria-keyshortcuts="Control+Enter"
                  title="Ctrl + Enter"
                  className={primaryBtn}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                  {a.phase === "loading"
                    ? `Cargando modelo · ${Math.round(a.progress * 100)} %`
                    : a.phase === "running"
                      ? a.chunks && a.chunks.total > 1
                        ? `Anonimizando · ${a.chunks.done + 1}/${a.chunks.total}`
                        : "Anonimizando…"
                      : "Anonimizar"}
                </button>
              </div>
            </div>
          </section>
        )}

        <NoticeBox notice={fileNotice} />
        <NoticeBox notice={a.error ? { kind: "error", text: a.error } : null} />
        {result && result.mapping.length > 0 && (
          <>
            <MappingTable mapping={result.mapping} />
            <RestorePanel mapping={result.mapping} />
          </>
        )}
      </main>

      <footer className="px-4 pb-5">
        <Credit />
      </footer>
    </div>
  );
}
