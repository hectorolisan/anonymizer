// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as engine from "@/lib/engine";
import { AnonymizerApp } from "./anonymizer-app";

const state = vi.hoisted(() => ({ loaded: null as string | null }));

vi.mock("@/lib/engine", () => ({
  DEFAULT_MODEL: "Qwen3-4B-q4f16_1-MLC",
  MODELS: [{ model_id: "Qwen3-4B-q4f16_1-MLC", vram_required_MB: 3431 }],
  modelName: (id: string) => id.replace(/-q4f16_1-MLC$/, ""),
  hasWebGPU: vi.fn(() => true),
  loadedModel: () => state.loaded,
  interrupt: vi.fn(),
  isCached: vi.fn(async () => false),
  deleteCached: vi.fn(async () => { state.loaded = null; }),
  loadModel: vi.fn(async (id: string, onProgress: (r: { progress: number }) => void) => {
    onProgress({ progress: 1 });
    state.loaded = id;
  }),
  extractEntities: vi.fn(async () => ({ personas: ["Ana Pérez"], empresas: [], direcciones: [] })),
}));

vi.stubGlobal("matchMedia", () => ({ matches: false }));

// jsdom has no modal dialogs.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(engine.hasWebGPU).mockReturnValue(true);
  state.loaded = null;
});
afterEach(cleanup);

const input = () => screen.getByLabelText<HTMLTextAreaElement>("Texto a anonimizar");
const button = (name: string | RegExp) => screen.getByRole("button", { name });

async function mount() {
  await act(async () => render(<AnonymizerApp />));
}

async function run(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  await act(async () => fireEvent.click(button(/Anonimizar/)));
}

test("carga el modelo al abrir y muestra solo el resultado tras anonimizar", async () => {
  await mount();
  expect(engine.loadModel).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toContain("Modelo listo");

  await run("Ana Pérez escribe desde ana@ejemplo.com");
  expect(engine.loadModel).toHaveBeenCalledTimes(1);
  expect(engine.extractEntities).toHaveBeenCalledWith("Qwen3-4B-q4f16_1-MLC", "Ana Pérez escribe desde [EMAIL_1]");
  expect(screen.queryByLabelText("Texto a anonimizar")).toBeNull();
  expect(screen.getByTestId("output").textContent).toBe("[PERSONA_1] escribe desde [EMAIL_1]");
  expect(screen.getByText("2 datos ·", { exact: false })).toBeTruthy();

  const rows = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
  expect(rows).toEqual(["[PERSONA_1]Ana PérezPersonas", "[EMAIL_1]ana@ejemplo.comEmails"]);

  fireEvent.change(screen.getByLabelText("Respuesta de la IA"), { target: { value: "Hola [PERSONA_1]" } });
  expect(screen.getByTestId("restored").textContent).toBe("Hola Ana Pérez");

  fireEvent.click(button("Editar texto"));
  expect(input().value).toBe("Ana Pérez escribe desde ana@ejemplo.com");
});

test("todas las categorías activas por defecto; desactivadas no se tapan", async () => {
  await mount();
  expect(button(/Categorías/).textContent).toContain("8/8");
  fireEvent.click(button(/Categorías/));
  expect(screen.getByRole("dialog")).toBeTruthy();

  const box = (name: string) => screen.getByRole<HTMLInputElement>("checkbox", { name: new RegExp(`^${name}`) });
  for (const c of ["Personas", "Importes", "Cuentas"]) expect(box(c).checked).toBe(true);
  for (const c of ["Personas", "Empresas", "Direcciones", "Teléfonos"]) fireEvent.click(box(c));
  expect(box("Personas").checked).toBe(false);
  expect(button(/Categorías/).textContent).toContain("4/8");

  fireEvent.click(button("Ninguna"));
  expect(button(/Categorías/).textContent).toContain("0/8");
  fireEvent.click(button("Todas"));
  for (const c of ["Personas", "Empresas", "Direcciones", "Teléfonos"]) fireEvent.click(box(c));
  fireEvent.click(button("Listo"));

  await run("Ana paga 300 euros desde el 612 345 678");
  expect(engine.extractEntities).not.toHaveBeenCalled();
  expect(screen.getByTestId("output").textContent).toBe("Ana paga [IMPORTE_1] desde el 612 345 678");
});

test("errores claros: texto vacío y navegador sin WebGPU", async () => {
  vi.mocked(engine.hasWebGPU).mockReturnValue(false);
  await mount();
  expect(engine.loadModel).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain("Sin WebGPU");

  await run("   ");
  expect(screen.getByRole("alert").textContent).toBe("No hay texto para anonimizar.");

  await run("Ana Pérez");
  expect(screen.getByRole("alert").textContent).toContain("no tiene WebGPU");
  expect(engine.extractEntities).not.toHaveBeenCalled();
});

test("descarga el resultado en el formato elegido", async () => {
  HTMLElement.prototype.hidePopover ??= () => {};
  const blobs: Blob[] = [];
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (b: Blob) => (blobs.push(b), "blob:x"), revokeObjectURL: () => {} }));
  await mount();
  await run("ana@ejemplo.com");
  fireEvent.click(screen.getByRole("menuitem", { name: ".json", hidden: true }));
  expect(blobs[0].type).toBe("application/json;charset=utf-8");
  expect(await blobs[0].text()).toBe("[EMAIL_1]");
});

test("Ctrl+Enter anonimiza y Cancelar vuelve al editor sin error", async () => {
  await mount();
  fireEvent.change(input(), { target: { value: "ana@ejemplo.com" } });
  await act(async () => fireEvent.keyDown(input(), { key: "Enter", ctrlKey: true }));
  expect(screen.getByTestId("output").textContent).toBe("[EMAIL_1]");

  fireEvent.click(button("Editar texto"));
  let finish = () => {};
  vi.mocked(engine.extractEntities).mockImplementationOnce(
    () => new Promise((resolve) => (finish = () => resolve({ personas: [], empresas: [], direcciones: [] }))),
  );
  fireEvent.change(input(), { target: { value: "Ana Pérez" } });
  await act(async () => fireEvent.click(button(/Anonimizar/)));
  fireEvent.click(button("Cancelar"));
  expect(engine.interrupt).toHaveBeenCalled();
  await act(async () => finish());
  expect(input().value).toBe("Ana Pérez");
  expect(screen.queryByRole("alert")).toBeNull();
});

test("borra de la caché un modelo descargado", async () => {
  vi.mocked(engine.isCached).mockResolvedValue(true);
  await mount();
  const picker = document.getElementById("model-picker")!;
  await act(async () => picker.dispatchEvent(Object.assign(new Event("beforetoggle"), { newState: "open" })));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Borrar Qwen3-4B/, hidden: true })));
  expect(engine.deleteCached).toHaveBeenCalledWith("Qwen3-4B-q4f16_1-MLC");
  expect(screen.getByRole("status").textContent).toContain("Modelo sin cargar");
});

test("Nuevo texto vuelve al editor vacío", async () => {
  await mount();
  await run("ana@ejemplo.com");
  fireEvent.click(button("Nuevo texto"));
  expect(input().value).toBe("");
});
