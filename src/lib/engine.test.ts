import { beforeEach, expect, test, vi } from "vitest";

const mlc = vi.hoisted(() => ({
  create: vi.fn(),
  reload: vi.fn(),
  unload: vi.fn(),
  deleteModelAllInfoInCache: vi.fn(),
}));

vi.mock("@mlc-ai/web-llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mlc-ai/web-llm")>()),
  deleteModelAllInfoInCache: mlc.deleteModelAllInfoInCache,
  WebWorkerMLCEngine: class {
    chat = { completions: { create: mlc.create } };
    reload = mlc.reload;
    unload = mlc.unload;
    setInitProgressCallback() {}
  },
}));

vi.stubGlobal("Worker", class {});

const engine = await import("./engine");

const reply = (content: string) => ({ choices: [{ message: { content } }] });

beforeEach(() => vi.clearAllMocks());

test("every curated model exists in prebuiltAppConfig", () => {
  expect(engine.MODELS).toHaveLength(3);
  expect(engine.MODELS.map((m) => m.model_id)).toContain(engine.DEFAULT_MODEL);
});

test("modelName strips quantisation and Instruct suffixes", () => {
  expect(engine.modelName("Qwen3-4B-q4f16_1-MLC")).toBe("Qwen3-4B");
  expect(engine.modelName("Llama-3.2-3B-Instruct-q4f16_1-MLC")).toBe("Llama-3.2-3B");
});

test("loadModel skips reload when the model is already loaded", async () => {
  await engine.loadModel("a", () => {});
  await engine.loadModel("a", () => {});
  expect(mlc.reload).toHaveBeenCalledTimes(1);
  expect(engine.loadedModel()).toBe("a");
});

test("loadModel leaves nothing loaded when reload fails", async () => {
  mlc.reload.mockRejectedValueOnce(new Error("oom"));
  await expect(engine.loadModel("b", () => {})).rejects.toThrow("oom");
  expect(engine.loadedModel()).toBeNull();
});

test("deleteCached unloads the model if it is in the GPU", async () => {
  await engine.loadModel("c", () => {});
  await engine.deleteCached("c");
  expect(mlc.unload).toHaveBeenCalled();
  expect(engine.loadedModel()).toBeNull();
  expect(mlc.deleteModelAllInfoInCache).toHaveBeenCalledWith("c");
});

test("extractEntities asks for schema JSON without thinking on Qwen3", async () => {
  mlc.create.mockResolvedValueOnce(reply('{"personas":["Ana"],"empresas":[],"direcciones":[]}'));
  const e = await engine.extractEntities("Qwen3-4B-q4f16_1-MLC", "Ana");
  expect(e.personas).toEqual(["Ana"]);
  const req = mlc.create.mock.calls[0][0];
  expect(req.temperature).toBe(0);
  expect(req.response_format.type).toBe("json_object");
  expect(JSON.parse(req.response_format.schema).required).toHaveLength(3);
  expect(req.extra_body).toEqual({ enable_thinking: false });
  expect(req.messages[0].content).toContain("<<<\nAna\n>>>");
});

test("extractEntities retries once, then fails clearly", async () => {
  mlc.create.mockResolvedValueOnce(reply("basura")).mockResolvedValueOnce(reply('{"personas":[]}'));
  await expect(engine.extractEntities("Llama", "x")).resolves.toEqual({ personas: [], empresas: [], direcciones: [] });
  expect(mlc.create.mock.calls[1][0].extra_body).toBeUndefined();

  mlc.create.mockResolvedValue(reply("basura"));
  await expect(engine.extractEntities("Llama", "x")).rejects.toThrow("tras un reintento");
});
