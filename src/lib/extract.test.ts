import { JSDOM } from "jsdom";
import JSZip from "jszip";
import { expect, test, vi } from "vitest";

const libs = vi.hoisted(() => ({ extractRawText: vi.fn(), getDocument: vi.fn() }));

vi.mock("mammoth", () => ({ extractRawText: libs.extractRawText }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: { workerPort: {} }, getDocument: libs.getDocument }));

const { window } = new JSDOM();
vi.stubGlobal("DOMParser", window.DOMParser);
vi.stubGlobal("Node", window.Node);

const { extractText, MAX_MB } = await import("./extract");

const file = (name: string, content: string | ArrayBuffer = "") => new File([content], name);

test("lee .txt, .md y .csv tal cual (sin espacios sobrantes)", async () => {
  await expect(extractText(file("nota.TXT", "  hola\n"))).resolves.toBe("hola");
  await expect(extractText(file("a.md", "# Título"))).resolves.toBe("# Título");
  await expect(extractText(file("clientes.csv", "nombre;email\nAna;ana@b.es\n"))).resolves.toBe("nombre;email\nAna;ana@b.es");
});

test("rechaza archivos de más de MAX_MB antes de leerlos", async () => {
  const big = file("enorme.txt", "x".repeat(MAX_MB * 1024 * 1024 + 1));
  await expect(extractText(big)).rejects.toThrow(`el máximo es ${MAX_MB} MB`);
  await expect(extractText(file("justo.txt", "x".repeat(MAX_MB * 1024 * 1024)))).resolves.toHaveLength(MAX_MB * 1024 * 1024);
});

test("extrae .odt: párrafos, títulos, espacios y saltos", async () => {
  const zip = new JSZip();
  zip.file(
    "content.xml",
    `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
      <office:body><office:text><text:h>Contrato</text:h><text:p>Ana<text:s text:c="2"/>Pérez<text:line-break/>Calle Goya 15</text:p></office:text></office:body>
    </office:document-content>`,
  );
  const data = await zip.generateAsync({ type: "arraybuffer" });
  await expect(extractText(file("c.odt", data))).resolves.toBe("Contrato\nAna  Pérez\nCalle Goya 15");
  await expect(extractText(file("roto.odt", "no zip"))).rejects.toThrow("¿archivo dañado?");
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
