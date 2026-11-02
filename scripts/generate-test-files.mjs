// Generates fictitious test documents in ./test-files (gitignored):
//   muestra.*  ~1 contract, to try every model quickly
//   limite.*   just under the 20 MB limit (MAX_MB in src/lib/extract.ts)
//   excede.txt just over the limit, must be rejected
// Usage: pnpm test-files
import { mkdir, writeFile } from "node:fs/promises";
import JSZip from "jszip";

const MAX = 20 * 1024 * 1024;
const LIMIT = MAX - 64 * 1024; // margin for zip/pdf overhead
const OUT = new URL("../test-files/", import.meta.url);

const NAMES = ["Ana", "Luis", "Marta", "Javier", "Lucía", "Carlos", "Elena", "Pablo", "Sofía", "Andrés"];
const SURNAMES = ["Pérez", "García", "Rodríguez", "Martín", "Sánchez", "López", "Díaz", "Hernández", "Suárez", "Medina"];
const COMPANIES = ["Talleres del Norte S.L.", "Cárnicas del Ebro S.A.", "Ficticia Consulting S.L.U.", "Cooperativa Agrícola Teide S.Coop.", "Distribuciones Atlántico S.A."];
const STREETS = ["Calle Goya", "Avenida de Canarias", "Paseo de Gracia", "Calle Mayor", "Plaza de España"];
const CITIES = ["28001 Madrid", "35002 Las Palmas de Gran Canaria", "08008 Barcelona", "38003 Santa Cruz de Tenerife", "41001 Sevilla"];

const pick = (list, i) => list[i % list.length];
const pad = (n, len) => String(n).padStart(len, "0");
const dni = (i) => {
  const n = (12345678 + i * 7919) % 100000000;
  return `${pad(n, 8)}${"TRWAGMYFPDXBNJZSQVHLCKE"[n % 23]}`;
};

// Valid control digits, so the checksum rules find them.
const cif = (i) => {
  const d = pad((1234567 + i * 7) % 10000000, 7);
  const sum = [...d].map(Number).reduce((a, n, k) => a + (k % 2 ? n : Math.floor((n * 2) / 10) + ((n * 2) % 10)), 0);
  return `B${d}${(10 - (sum % 10)) % 10}`;
};
const nss = (i) => {
  const n = 10000000 + ((i * 7919) % 90000000);
  return `28/${n}/${pad(Number(`28${n}`) % 97, 2)}`;
};
const card = (i) => {
  const body = `4${pad((i * 104729) % 1e14, 14)}`;
  let sum = 0;
  for (const [k, c] of [...body].reverse().entries()) {
    const n = Number(c) * (k % 2 ? 1 : 2);
    sum += n > 9 ? n - 9 : n;
  }
  return `${body}${(10 - (sum % 10)) % 10}`.replace(/(\d{4})(?=\d)/g, "$1 ");
};

function record(i) {
  const person = `${pick(NAMES, i)} ${pick(SURNAMES, i * 3)} ${pick(SURNAMES, i * 7 + 1)}`;
  const contact = `${pick(NAMES, i + 4)} ${pick(SURNAMES, i + 5)}`;
  const user = `${pick(NAMES, i)}.${pick(SURNAMES, i * 3)}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  return {
    person,
    contact,
    dni: dni(i),
    nie: `X${pad((1234567 + i * 31) % 10000000, 7)}L`,
    email: `${user}${i}@ejemplo.com`,
    phone: `+34 6${pad((12345678 + i * 104729) % 100000000, 8).replace(/(\d{2})(\d{3})(\d{3})/, "$1 $2 $3")}`,
    company: pick(COMPANIES, i),
    address: `${pick(STREETS, i)} ${(i % 200) + 1}, ${(i % 9) + 1}º izq, ${pick(CITIES, i)}`,
    iban: `ES91 2100 ${pad(i % 10000, 4)} ${pad((i * 13) % 10000, 4)} ${pad((i * 17) % 10000, 4)} ${pad((i * 19) % 10000, 4)}`,
    cif: cif(i),
    nss: nss(i),
    card: card(i),
    passport: `PA${pad((i * 31) % 1000000, 6)}`,
    plate: `${pad((i * 97) % 10000, 4)} ${pick(["BCD", "FGH", "JKL", "MNP", "RST"], i)}`,
    birth: `${pad((i % 28) + 1, 2)}/${pad((i % 12) + 1, 2)}/${1960 + (i % 40)}`,
    ip: `192.168.${i % 256}.${(i * 7) % 254 + 1}`,
    url: `https://ejemplo.com/clientes/${i + 1}`,
    amount: `${((i % 90) + 1).toLocaleString("es-ES")}.${pad((i * 37) % 1000, 3)},00`,
  };
}

// One contract as a list of paragraphs.
function contract(i) {
  const r = record(i);
  return [
    `CONTRATO DE PRESTACIÓN DE SERVICIOS Nº ${i + 1}`,
    "En Madrid, a 12 de marzo de 2026.",
    `De una parte, ${r.person}, con DNI ${r.dni}, en nombre de ${r.company}, con domicilio en ${r.address}.`,
    `De otra parte, ${r.contact}, con NIE ${r.nie}, que actúa en su propio nombre.`,
    `Contacto: ${r.email} o en el teléfono ${r.phone}.`,
    `${r.person}, nacido el ${r.birth}, con pasaporte ${r.passport} y número de la Seguridad Social ${r.nss}. ${r.company} tiene CIF ${r.cif}.`,
    `Pago con la tarjeta ${r.card}. Vehículo con matrícula ${r.plate}. Alta desde la IP ${r.ip} en ${r.url}.`,
    `El importe total asciende a ${r.amount} EUR, que se abonará en la cuenta ${r.iban}.`,
    `Ambas partes, ${r.person} y ${r.contact}, firman el presente contrato.`,
  ];
}

const bytes = (s) => Buffer.byteLength(s, "utf8");

// Repeat contracts until ~`target` bytes, counting `overhead` markup bytes per paragraph.
function fill(target, overhead) {
  const paragraphs = [];
  let size = 0;
  for (let i = 0; size < target; i++)
    for (const p of [...contract(i), ""]) {
      paragraphs.push(p);
      size += bytes(p) + overhead;
    }
  return paragraphs;
}
const sizeOf = (data) => (typeof data === "string" ? bytes(data) : data.length);
const xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function txt(paragraphs) {
  return paragraphs.join("\n");
}

function md(paragraphs) {
  return paragraphs.map((p) => (p.startsWith("CONTRATO") ? `## ${p}` : p)).join("\n");
}

function csv(target) {
  const rows = ["nombre,dni,email,telefono,empresa,direccion,iban,importe"];
  for (let i = 0, size = 0; size < target; i++) {
    const r = record(i);
    const row = [r.person, r.dni, r.email, r.phone, r.company, r.address, r.iban, `${r.amount} €`].map((v) => `"${v}"`).join(",");
    rows.push(row);
    size += bytes(row) + 1;
  }
  return rows.join("\n");
}

function json(target) {
  const rows = [];
  for (let i = 0, size = 0; size < target; i++) {
    const r = record(i);
    const row = JSON.stringify({
      nombre: r.person, dni: r.dni, email: r.email, telefono: r.phone,
      empresa: r.company, direccion: r.address, iban: r.iban, importe: `${r.amount} €`,
    });
    rows.push(row);
    size += bytes(row) + 4;
  }
  return `[\n  ${rows.join(",\n  ")}\n]`;
}

// Uncompressed (STORE) so the file size matches the text size.
async function docx(paragraphs) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${xml(p)}</w:t></w:r></w:p>`).join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}

async function odt(paragraphs) {
  const zip = new JSZip();
  // mimetype must be the first entry, uncompressed.
  zip.file("mimetype", "application/vnd.oasis.opendocument.text");
  zip.file(
    "META-INF/manifest.xml",
    `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`,
  );
  const body = paragraphs
    .map((p) => (p.startsWith("CONTRATO") ? `<text:h text:outline-level="2">${xml(p)}</text:h>` : `<text:p>${xml(p)}</text:p>`))
    .join("");
  zip.file(
    "content.xml",
    `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${body}</office:text></office:body></office:document-content>`,
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}

// Minimal PDF 1.4: Helvetica, WinAnsi (latin1) text, 45 lines per A4 page.
function pdf(paragraphs) {
  const lines = paragraphs.flatMap((p) => (p ? p.match(/.{1,95}(\s|$)/g).map((l) => l.trim()) : [""]));
  const pages = [];
  for (let i = 0; i < lines.length; i += 45) pages.push(lines.slice(i, i + 45));

  const objects = [];
  const add = (body) => objects.push(body) + 2; // object ids start at 3 (1 catalog, 2 pages)
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const kids = pages.map((page) => {
    const text = page
      .map((l) => `(${l.replace(/[\\()]/g, "\\$&")}) Tj T*`)
      .join("\n");
    const stream = `BT /F1 10 Tf 14 TL 50 800 Td\n${text}\nET`;
    const content = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
  });

  const all = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`,
    ...objects,
  ];
  let out = "%PDF-1.4\n";
  const offsets = all.map((body, i) => {
    const offset = Buffer.byteLength(out, "latin1");
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${all.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${pad(o, 10)} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${all.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function write(name, data) {
  await writeFile(new URL(name, OUT), data);
  const size = sizeOf(data);
  console.log(`${name.padEnd(12)} ${(size / 1024 / 1024).toFixed(2).padStart(6)} MB${size > MAX ? "  (excede)" : ""}`);
}

await mkdir(OUT, { recursive: true });

const sample = contract(0);
await write("muestra.txt", txt(sample));
await write("muestra.md", md(sample));
await write("muestra.csv", csv(1000));
await write("muestra.json", json(1000));
await write("muestra.docx", await docx(sample));
await write("muestra.odt", await odt(sample));
await write("muestra.pdf", pdf(sample));

// Rescale the text until the built file lands within 1 % under LIMIT.
async function fit(build) {
  let target = LIMIT;
  let out;
  for (let k = 0; k < 4; k++) {
    out = await build(fill(target, 1));
    const size = sizeOf(out);
    if (size <= LIMIT && size > LIMIT * 0.99) break;
    target *= (LIMIT * 0.995) / size;
  }
  return out;
}

await write("limite.txt", await fit(txt));
await write("limite.md", await fit(md));
await write("limite.csv", csv(LIMIT));
await write("limite.json", json(LIMIT - 16));
await write("limite.docx", await fit(docx));
await write("limite.odt", await fit(odt));
await write("limite.pdf", await fit(pdf));

await write("excede.txt", txt(fill(MAX + 64 * 1024, 1)));
