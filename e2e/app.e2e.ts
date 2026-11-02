import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// No WebGPU: the regex-only flow runs and no model is downloaded.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    delete (Object.getPrototypeOf(navigator) as { gpu?: unknown }).gpu;
  });
  await page.goto("/");
  await expect(page.getByText("Sin WebGPU · solo regex")).toBeVisible();
  await page.getByRole("button", { name: /Categorías/ }).click();
  for (const c of ["Personas", "Empresas", "Direcciones"]) await page.getByRole("checkbox", { name: new RegExp(`^${c}`) }).uncheck();
  await page.getByRole("button", { name: "Listo" }).click();
});

test("anonimiza, descarga y restaura la respuesta", async ({ page }) => {
  await page.getByLabel("Texto a anonimizar").fill("Escribe a ana@ejemplo.com o al 612 345 678. DNI 12345678Z.");
  await page.getByLabel("Texto a anonimizar").press("Control+Enter");
  await expect(page.getByTestId("output")).toHaveText("Escribe a [EMAIL_1] o al [TELEFONO_1]. DNI [DNI_1].");

  await page.getByRole("button", { name: "Descargar" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: ".txt" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("anonimizado.txt");
  expect(await readFile(await file.path(), "utf8")).toBe("Escribe a [EMAIL_1] o al [TELEFONO_1]. DNI [DNI_1].");

  await page.getByLabel("Respuesta de la IA").fill("Hola [EMAIL_1], tu DNI es [DNI_1].");
  await expect(page.getByTestId("restored")).toHaveText("Hola ana@ejemplo.com, tu DNI es 12345678Z.");
});

test("abre un .json y lo anonimiza", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "clientes.json",
    mimeType: "application/json",
    buffer: Buffer.from('[{"email": "luis@ejemplo.com"}]'),
  });
  await expect(page.getByText("Texto extraído de “clientes.json”")).toBeVisible();
  await page.getByRole("button", { name: "Anonimizar" }).click();
  await expect(page.getByTestId("output")).toHaveText('[{"email": "[EMAIL_1]"}]');
});
