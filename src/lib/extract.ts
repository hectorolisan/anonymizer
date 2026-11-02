// Text extraction in the browser: the file never leaves the tab. No OCR.

export const ACCEPT = ".txt,.md,.docx,.pdf";

export class ExtractionError extends Error {}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith(".txt") || name.endsWith(".md")) text = await file.text();
  else if (name.endsWith(".docx")) text = await extractDocx(await file.arrayBuffer());
  else if (name.endsWith(".pdf")) text = await extractPdf(await file.arrayBuffer());
  else if (name.endsWith(".doc"))
    throw new ExtractionError("El formato .doc antiguo no está soportado. Guárdalo como .docx y vuelve a intentarlo.");
  else throw new ExtractionError("Formato no soportado. Usa .txt, .md, .docx o .pdf.");

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

async function extractPdf(data: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(
    new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
    { type: "module" },
  );
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
