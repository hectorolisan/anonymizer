// Text extraction in the browser: the file never leaves the tab. No OCR.

export const FORMATS = [
  { ext: ".txt, .md, .csv", label: "Texto plano" },
  { ext: ".docx", label: "Word" },
  { ext: ".odt", label: "LibreOffice / OpenDocument" },
  { ext: ".pdf", label: "Con texto seleccionable (sin OCR)" },
];

export const ACCEPT = ".txt,.md,.csv,.docx,.odt,.pdf";

// The model reads ~2000 chars per call: bigger files mean very long runs in the browser.
export const MAX_MB = 20;

export class ExtractionError extends Error {}

export async function extractText(file: File): Promise<string> {
  if (file.size > MAX_MB * 1024 * 1024)
    throw new ExtractionError(
      `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_MB} MB.`,
    );
  const name = file.name.toLowerCase();
  let text: string;
  if ([".txt", ".md", ".csv"].some((ext) => name.endsWith(ext))) text = await file.text();
  else if (name.endsWith(".docx")) text = await extractDocx(await file.arrayBuffer());
  else if (name.endsWith(".odt")) text = await extractOdt(await file.arrayBuffer());
  else if (name.endsWith(".pdf")) text = await extractPdf(await file.arrayBuffer());
  else if (name.endsWith(".doc"))
    throw new ExtractionError("El formato .doc antiguo no está soportado. Guárdalo como .docx y vuelve a intentarlo.");
  else throw new ExtractionError("Formato no soportado. Usa .txt, .md, .csv, .docx, .odt o .pdf.");

  text = text.trim();
  if (!text && name.endsWith(".pdf"))
    throw new ExtractionError(
      "Este PDF no tiene texto extraíble: parece escaneado (imagen). No se hace OCR, pega el texto a mano.",
    );
  if (!text) throw new ExtractionError("El archivo no contiene texto.");
  return text;
}

async function extractDocx(data: ArrayBuffer) {
  const mammoth = await import("mammoth");
  try {
    return (await mammoth.extractRawText({ arrayBuffer: data })).value;
  } catch (err) {
    throw new ExtractionError("No se pudo leer el .docx (¿archivo dañado?).", { cause: err });
  }
}

const TEXT_NS = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";

// ODF text: one line per paragraph/heading, <text:s c="n"/> spaces, tabs and line breaks.
function odfText(node: Node): string {
  let out = "";
  for (const n of node.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) out += n.nodeValue;
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const el = n as Element;
    const tag = el.namespaceURI === TEXT_NS ? el.localName : "";
    if (tag === "s") out += " ".repeat(Number(el.getAttribute("text:c") ?? 1));
    else if (tag === "tab") out += "\t";
    else if (tag === "line-break") out += "\n";
    else if (tag === "p" || tag === "h") out += `${odfText(el)}\n`;
    else out += odfText(el);
  }
  return out;
}

async function extractOdt(data: ArrayBuffer) {
  const { default: JSZip } = await import("jszip");
  try {
    const xml = await (await JSZip.loadAsync(data)).file("content.xml")?.async("string");
    if (!xml) throw new Error("sin content.xml");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("XML inválido");
    return odfText(doc.documentElement);
  } catch (err) {
    throw new ExtractionError("No se pudo leer el .odt (¿archivo dañado?).", { cause: err });
  }
}

async function extractPdf(data: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  // Plain asset URL: as `new Worker(...)` Turbopack wraps it in a bootstrap that fails to start.
  pdfjs.GlobalWorkerOptions.workerSrc ||= new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
  try {
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const { items } = await (await pdf.getPage(i)).getTextContent();
      pages.push(items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : "")).join(""));
    }
    return pages.filter((p) => p.trim()).join("\n\n");
  } catch (err) {
    throw new ExtractionError("No se pudo leer el PDF (¿archivo dañado?).", { cause: err });
  }
}
