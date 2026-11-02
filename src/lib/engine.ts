import {
  WebWorkerMLCEngine,
  deleteModelAllInfoInCache,
  hasModelInCache,
  prebuiltAppConfig,
  type InitProgressReport,
  type ResponseFormat,
} from "@mlc-ai/web-llm";
import { AnonymizeError, buildPrompt, ENTITIES_SCHEMA, parseEntities, type Entities } from "./anonymize";

// Qwen3-4B matches the reference (qwen3:4b on Ollama); the rest are lighter or alternative families.
const MODEL_IDS = [
  "Qwen3-1.7B-q4f16_1-MLC",
  "Qwen3-4B-q4f16_1-MLC",
  "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  "gemma-4-E2B-it-q4f16_1-MLC",
];

export const MODELS = MODEL_IDS.map((id) =>
  prebuiltAppConfig.model_list.find((m) => m.model_id === id),
).filter((m) => m !== undefined);

export const DEFAULT_MODEL = "Qwen3-4B-q4f16_1-MLC";

export const modelName = (id: string) => id.replace(/-q4f16_1-MLC$/, "").replace(/-(Instruct|it)$/, "");

export const hasWebGPU = () => typeof navigator !== "undefined" && "gpu" in navigator;

let engine: WebWorkerMLCEngine | null = null;
let loaded: string | null = null;

function getEngine() {
  engine ??= new WebWorkerMLCEngine(
    new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" }),
  );
  return engine;
}

export async function loadModel(id: string, onProgress: (r: InitProgressReport) => void) {
  if (loaded === id) return;
  const e = getEngine();
  e.setInitProgressCallback(onProgress);
  loaded = null;
  await e.reload(id);
  loaded = id;
}

export const loadedModel = () => loaded;

export const isCached = (id: string) => hasModelInCache(id);

export async function deleteCached(id: string) {
  if (loaded === id) {
    await engine?.unload();
    loaded = null;
  }
  await deleteModelAllInfoInCache(id);
}

// JSON constrained by schema; one retry, then a clear error (never a half-anonymised text).
export async function extractEntities(model: string, text: string): Promise<Entities> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await getEngine().chat.completions.create({
      model,
      messages: [{ role: "user", content: buildPrompt(text) }],
      temperature: 0,
      max_tokens: 1024,
      response_format: { type: "json_object", schema: ENTITIES_SCHEMA } as ResponseFormat,
      ...(model.startsWith("Qwen3") && { extra_body: { enable_thinking: false } }),
    });
    try {
      return parseEntities(reply.choices[0]?.message.content ?? "");
    } catch (err) {
      lastErr = err;
    }
  }
  throw new AnonymizeError(
    "El modelo no devolvió un JSON válido tras un reintento. No se ha anonimizado nada para no mostrarte un texto a medias.",
    { cause: lastErr },
  );
}
