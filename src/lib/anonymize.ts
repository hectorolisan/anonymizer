// Regex for fixed patterns + local LLM for names, companies and addresses.
// Ported from beailabs/anonimizador (backend/anonymize.py).

export const CATEGORIES = [
  "PERSONA", "EMPRESA", "EMAIL", "TELEFONO", "DNI", "IMPORTE", "DIRECCION", "CUENTA",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  PERSONA: "Personas",
  EMPRESA: "Empresas",
  EMAIL: "Emails",
  TELEFONO: "Teléfonos",
  DNI: "DNI/NIE",
  IMPORTE: "Importes",
  DIRECCION: "Direcciones",
  CUENTA: "Cuentas",
};

// Importes off by default: usually needed to work with the text.
export const DEFAULT_CATEGORIES: Category[] = CATEGORIES.filter((c) => c !== "IMPORTE");

const MODEL_CATEGORIES: Category[] = ["PERSONA", "EMPRESA", "DIRECCION"];

export const needsModel = (active: Iterable<Category>) =>
  [...active].some((c) => MODEL_CATEGORIES.includes(c));

export type Entities = { personas: string[]; empresas: string[]; direcciones: string[] };
export type MappingItem = { placeholder: string; original: string; category: Category };
export type Extractor = (text: string) => Promise<Entities>;

export class AnonymizeError extends Error {}

// --- Regex, in application order (most specific first) ----------------------

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

// DNI: 8 digits + letter. NIE: X/Y/Z + 7 digits + letter. Dots and dash allowed.
const DNI_RE = /(?<![\dA-Za-z])(?:[XYZxyz]-?\d(?:\.?\d){6}|\d(?:\.?\d){7})-?[A-Za-z](?![\dA-Za-z])/g;

// IBAN (also partial: country + check + 2+ groups of 4) and 20-digit CCC.
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ \-]?\d{4}){2,7}(?:[ \-]?\d{1,3})?\b/g;
const CCC_RE = /(?<!\d)\d{4}[ \-]?\d{4}[ \-]?\d{2}[ \-]?\d{10}(?!\d)/g;

const IMPORTE_RE =
  /(?:(?:€|EUR|eur)\s?\d(?:[\d.,]*\d)?)|(?:\d(?:[\d.,]*\d)?\s?(?:€|EUR|euros?|eur))|(?:\b\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?\b)/g;

// Spanish phone: 9 digits, optional +34/0034, optional separators.
const TELEFONO_RE =
  /(?<![\p{L}\p{N}_])(?:(?:\+34|0034)[ \-]?)?(?:\d{3}[ \-]?\d{3}[ \-]?\d{3}|\d{3}[ \-]?\d{2}[ \-]?\d{2}[ \-]?\d{2})(?![\p{L}\p{N}_])/gu;

const UP = "[A-ZÁÉÍÓÚÑ]";

// Companies with Spanish legal form, up to 4 words before it.
const LEGAL = String.raw`S\.L\.U\.|S\.L\.L\.|S\.A\.U\.|S\.Coop\.|S\.C\.P\.|S\.R\.L\.|S\.A\.T\.|S\.L\.|S\.A\.|S\.C\.`;
const NOT_LEGAL = `(?!(?:${LEGAL}))`;
const CO_WORD = `${NOT_LEGAL}${UP}[\\p{L}\\p{N}_'&.\\-]*`;
const EMPRESA_RE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])${CO_WORD}(?:\s+(?:de|del|la|las|los|y|e|${CO_WORD})){0,4}\s+(?:${LEGAL})`,
  "gu",
);

// Street type + name + number, with optional floor, postcode and city.
const VIA = String.raw`(?:C/|Calle|Avda\.?|Avenida|Av\.|Plaza|Pza\.?|Pl\.|Paseo|Ronda|Carretera|Ctra\.?|Camino|Travesía|Glorieta|Callejón|Vía|Urbanización|Urb\.?)`;
const NAME_WORD = `${UP}[A-Za-zÁÉÍÓÚÑáéíóúñ'’\\-]*`;
const VIA_NOMBRE = String.raw`(?:(?:de|del|la|las|los|y)\s+){0,2}${NAME_WORD}(?:\s+(?:de|del|la|las|los|y|${NAME_WORD})){0,4}`;
// Details must look like an address (digit, capital or floor word) to not swallow prose.
const VIA_DETALLE = String.raw`(?:\s*,\s*(?:\d[^,\n.]{0,30}|${UP}[^,\n.]{0,30}|(?:bajo|ático|entresuelo|principal|izquierda|derecha|izq|dcha|planta|puerta|piso|esc|pta)[^,\n.]{0,30})){0,3}`;
const DIRECCION_RE = new RegExp(
  String.raw`${VIA}\s+${VIA_NOMBRE},?\s+(?:n[.ºo]?\s*)?\d{1,4}(?:\s?bis)?[A-Za-zºª]?${VIA_DETALLE}`,
  "g",
);

type Rule = [Category, RegExp];

// Before the model: the model already sees the placeholders.
const FIXED_RULES: Rule[] = [
  ["EMAIL", EMAIL_RE],
  ["DNI", DNI_RE],
  ["CUENTA", IBAN_RE],
  ["CUENTA", CCC_RE],
  ["IMPORTE", IMPORTE_RE],
  ["TELEFONO", TELEFONO_RE],
];

// After the model: it sets entity bounds first, regex catches what it missed.
const FALLBACK_RULES: Rule[] = [
  ["EMPRESA", EMPRESA_RE],
  ["DIRECCION", DIRECCION_RE],
];

// Dedup key: same entity -> same placeholder.
export function normalize(category: Category, value: string) {
  const v = value.trim();
  if (category === "EMAIL") return v.toLowerCase();
  if (category === "TELEFONO" || category === "DNI" || category === "CUENTA") return v.replace(/[\s\-]/g, "").toUpperCase();
  if (category === "IMPORTE") return v.replace(/\s/g, "");
  return v.replace(/\s+/g, " ").toLowerCase();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function createMapper() {
  const counters = new Map<Category, number>();
  const byKey = new Map<string, string>();
  const mapping: MappingItem[] = [];

  const placeholderFor = (category: Category, original: string) => {
    const key = `${category}::${normalize(category, original)}`;
    const existing = byKey.get(key);
    if (existing) return existing;
    const n = (counters.get(category) ?? 0) + 1;
    counters.set(category, n);
    const placeholder = `[${category}_${n}]`;
    byKey.set(key, placeholder);
    mapping.push({ placeholder, original: original.trim(), category });
    return placeholder;
  };

  const applyRegex = (text: string, rules: Rule[]) =>
    rules.reduce((t, [category, re]) => t.replace(re, (m) => placeholderFor(category, m)), text);

  // Longest first so overlapping entities don't break; whole words only.
  const applyEntities = (text: string, category: Category, values: string[]) => {
    const clean = [...new Set(values.map((v) => v.trim()))].filter((v) => v.length >= 2 && !v.startsWith("["));
    for (const v of clean.sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(v)}(?![\\p{L}\\p{N}_])`, "gu");
      text = text.replace(re, () => placeholderFor(category, v));
    }
    return text;
  };

  return { mapping, applyRegex, applyEntities };
}

export async function anonymize(text: string, categories: Iterable<Category>, extract: Extractor) {
  if (!text.trim()) throw new AnonymizeError("No hay texto para anonimizar.");
  const active = new Set(categories);
  if (!active.size) throw new AnonymizeError("Marca al menos una categoría que anonimizar.");

  const m = createMapper();
  text = m.applyRegex(text, FIXED_RULES.filter(([c]) => active.has(c)));

  if (needsModel(active)) {
    const all: Entities = { personas: [], empresas: [], direcciones: [] };
    for (const part of chunk(text)) {
      const e = await extract(part);
      all.personas.push(...e.personas);
      all.empresas.push(...e.empresas);
      all.direcciones.push(...e.direcciones);
    }
    if (active.has("PERSONA")) text = m.applyEntities(text, "PERSONA", all.personas);
    if (active.has("EMPRESA")) text = m.applyEntities(text, "EMPRESA", all.empresas);
    if (active.has("DIRECCION")) text = m.applyEntities(text, "DIRECCION", all.direcciones);
  }

  text = m.applyRegex(text, FALLBACK_RULES.filter(([c]) => active.has(c)));
  return { anonymized: text, mapping: m.mapping };
}

const PLACEHOLDER_RE = /\[([A-Z]+)_\d+\]/g;

export type Segment = string | MappingItem;

// Only placeholders in the mapping are highlighted, not ones typed in the original.
export function segments(text: string, mapping: MappingItem[]): Segment[] {
  const map = new Map(mapping.map((m) => [m.placeholder, m]));
  const out: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    const item = map.get(match[0]);
    if (!item) continue;
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(item);
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Model context is 4096 tokens: split by lines into ~CHUNK chars.
export const CHUNK = 2000;

export function chunk(text: string, max = CHUNK) {
  const parts: string[] = [];
  let cur = "";
  const add = (piece: string) => {
    if (cur && cur.length + piece.length + 1 > max) {
      parts.push(cur);
      cur = piece;
    } else cur = cur ? `${cur}\n${piece}` : piece;
  };
  for (let line of text.split("\n")) {
    while (line.length > max) {
      const space = line.lastIndexOf(" ", max);
      const cut = space > 0 ? space : max;
      add(line.slice(0, cut));
      line = line.slice(cut).trimStart();
    }
    add(line);
  }
  if (cur.trim()) parts.push(cur);
  return parts.filter((p) => p.trim());
}

// --- Model prompt + response validation -----------------------------------

export const ENTITIES_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    personas: { type: "array", items: { type: "string" } },
    empresas: { type: "array", items: { type: "string" } },
    direcciones: { type: "array", items: { type: "string" } },
  },
  required: ["personas", "empresas", "direcciones"],
});

export const buildPrompt = (text: string) => `Eres un extractor de entidades para anonimizar texto en español.

Analiza el TEXTO y extrae SOLO estas categorías, copiando las cadenas EXACTAMENTE como aparecen:
- "personas": nombres de personas (nombre y/o apellidos).
- "empresas": nombres de empresas, marcas u organizaciones. Incluye SIEMPRE las que llevan
  forma jurídica como S.L., S.A., S.L.U., S.A.U., S.Coop., S.C. o similares, y toma el nombre
  completo con esa forma jurídica.
- "direcciones": domicilios y direcciones postales, COMPLETAS o PARCIALES (incluye
  calle y número aunque falten el piso, el código postal o la ciudad).

Reglas:
- NO incluyas emails, teléfonos, DNI, importes ni cuentas: ya están sustituidos por marcadores como [EMAIL_1].
- NO inventes datos que no estén en el texto.
- Copia cada valor tal cual aparece, sin reformatear.
- Responde ÚNICAMENTE con un objeto JSON válido, sin explicaciones ni texto adicional.

EJEMPLO (datos ficticios)
Texto: "Ana Ejemplo, de Talleres Ficticios S.L., vive en Calle Inventada 1, 00000 Villaejemplo."
Respuesta: {"personas": ["Ana Ejemplo"], "empresas": ["Talleres Ficticios S.L."], "direcciones": ["Calle Inventada 1, 00000 Villaejemplo"]}

Formato de salida EXACTO:
{"personas": [], "empresas": [], "direcciones": []}

TEXTO:
<<<
${text}
>>>`;

// First balanced JSON object, tolerating <think>…</think> or other noise.
export function parseEntities(raw: string): Entities {
  raw = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("sin JSON en la respuesta");
  let depth = 0;
  let end = -1;
  for (let i = start; i < raw.length && end === -1; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}" && --depth === 0) end = i;
  }
  if (end === -1) throw new Error("JSON incompleto en la respuesta");
  const obj: unknown = JSON.parse(raw.slice(start, end + 1));
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("la respuesta no es un objeto");

  const list = (key: keyof Entities) => {
    const v = (obj as Record<string, unknown>)[key] ?? [];
    if (!Array.isArray(v)) throw new Error(`'${key}' no es una lista`);
    return v.map(String);
  };
  return { personas: list("personas"), empresas: list("empresas"), direcciones: list("direcciones") };
}
