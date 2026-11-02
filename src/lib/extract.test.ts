import { expect, test, vi } from "vitest";

const libs = vi.hoisted(() => ({ extractRawText: vi.fn(), getDocument: vi.fn() }));

vi.mock("mammoth", () => ({ extractRawText: libs.extractRawText }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: { workerPort: {} }, getDocument: libs.getDocument }));

const { extractText } = await import("./extract");

const file = (name: string, content: string | ArrayBuffer = "") => new File([content], name);

test("lee .txt y .md tal cual (sin espacios sobrantes)", async () => {
  await expect(extractText(file("nota.TXT", "  hola\n"))).resolves.toBe("hola");
  await expect(extractText(file("a.md", "# Título"))).resolves.toBe("# Título");
});

test("rechaza formatos no soportados y .doc antiguo", async () => {
  await expect(extractText(file("foto.png"))).rejects.toThrow("Formato no soportado");
  await expect(extractText(file("viejo.doc"))).rejects.toThrow(".doc antiguo");
  await expect(extractText(file("vacio.txt", "   "))).rejects.toThrow("no contiene texto");
});

test("extrae .docx con mammoth", async () => {
  libs.extractRawText.mockResolvedValueOnce({ value: "Contrato\nAna" });
  await expect(extractText(file("c.docx", "zip"))).resolves.toBe("Contrato\nAna");
  libs.extractRawText.mockRejectedValueOnce(new Error("bad zip"));
  await expect(extractText(file("c.docx", "zip"))).rejects.toThrow("¿archivo dañado?");
});

test("extrae .pdf página a página y avisa de PDFs escaneados", async () => {
  const page = (...items: object[]) => ({ getTextContent: async () => ({ items }) });
  const pdf = (...pages: object[]) => ({
    promise: Promise.resolve({ numPages: pages.length, getPage: async (i: number) => pages[i - 1] }),
  });

  libs.getDocument.mockReturnValueOnce(
    pdf(page({ str: "Hola", hasEOL: true }, { str: "Ana", hasEOL: false }), page({ str: "Fin", hasEOL: false })),
  );
  await expect(extractText(file("a.pdf", "%PDF"))).resolves.toBe("Hola\nAna\n\nFin");

  libs.getDocument.mockReturnValueOnce(pdf(page(), page({ str: " ", hasEOL: false })));
  await expect(extractText(file("scan.pdf", "%PDF"))).rejects.toThrow("parece escaneado");
});
