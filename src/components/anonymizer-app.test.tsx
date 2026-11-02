// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as engine from "@/lib/engine";
import { AnonymizerApp } from "./anonymizer-app";

vi.mock("@/lib/engine", () => ({
  DEFAULT_MODEL: "Qwen3-4B-q4f16_1-MLC",
  MODELS: [{ model_id: "Qwen3-4B-q4f16_1-MLC", vram_required_MB: 3431 }],
  modelName: (id: string) => id.replace(/-q4f16_1-MLC$/, ""),
  hasWebGPU: vi.fn(() => true),
  loadedModel: vi.fn(() => null),
  loadModel: vi.fn(async (_id: string, onProgress: (r: { progress: number }) => void) => onProgress({ progress: 1 })),
  extractEntities: vi.fn(async () => ({ personas: ["Ana Pérez"], empresas: [], direcciones: [] })),
}));

vi.stubGlobal("matchMedia", () => ({ matches: false }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const input = () => screen.getByLabelText("Texto a anonimizar");
const anonymizeBtn = () => screen.getByRole("button", { name: /Anonimizar/ });

async function run(text: string) {
  fireEvent.change(input(), { target: { value: text } });
  await act(async () => fireEvent.click(anonymizeBtn()));
}

test("anonimiza y muestra el mapa de equivalencias", async () => {
  render(<AnonymizerApp />);
  await run("Ana Pérez escribe desde ana@ejemplo.com");

  expect(engine.loadModel).toHaveBeenCalledWith("Qwen3-4B-q4f16_1-MLC", expect.any(Function));
  expect(engine.extractEntities).toHaveBeenCalledWith("Qwen3-4B-q4f16_1-MLC", "Ana Pérez escribe desde [EMAIL_1]");
  expect(screen.getByTestId("output").textContent).toBe("[PERSONA_1] escribe desde [EMAIL_1]");
  expect(screen.getByText("2 datos ·", { exact: false })).toBeTruthy();
  expect(screen.getByRole("status", { name: "" }).textContent).toContain("Modelo listo");

  const rows = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
  expect(rows).toEqual(["[EMAIL_1]ana@ejemplo.comEmails", "[PERSONA_1]Ana PérezPersonas"]);
});

test("las casillas activan y desactivan categorías; sin categorías del modelo no se carga", async () => {
  render(<AnonymizerApp />);
  const box = (name: string) => screen.getByRole<HTMLInputElement>("checkbox", { name });
  expect(box("Importes").checked).toBe(false);
  expect(box("Personas").checked).toBe(true);
  for (const name of ["Personas", "Empresas", "Direcciones"]) fireEvent.click(box(name));
  expect(box("Personas").checked).toBe(false);

  await run("Llama al 612 345 678");
  expect(engine.loadModel).not.toHaveBeenCalled();
  expect(screen.getByTestId("output").textContent).toBe("Llama al [TELEFONO_1]");
});

test("errores claros: texto vacío y navegador sin WebGPU", async () => {
  render(<AnonymizerApp />);
  await run("   ");
  expect(screen.getByRole("alert").textContent).toBe("No hay texto para anonimizar.");

  vi.mocked(engine.hasWebGPU).mockReturnValue(false);
  await run("Ana Pérez");
  expect(screen.getByRole("alert").textContent).toContain("no tiene WebGPU");
  expect(engine.extractEntities).not.toHaveBeenCalled();
});

test("Limpiar vuelve al estado vacío", async () => {
  vi.mocked(engine.hasWebGPU).mockReturnValue(true);
  render(<AnonymizerApp />);
  await run("ana@ejemplo.com");
  fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
  expect((input() as HTMLTextAreaElement).value).toBe("");
  expect(screen.getByText("Aquí aparecerá el texto", { exact: false })).toBeTruthy();
});
