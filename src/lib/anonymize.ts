// Regex for fixed patterns + local LLM for names, companies and addresses.
// Ported from beailabs/anonimizador (backend/anonymize.py).

export const CATEGORIES = [
  "PERSONA", "EMPRESA", "EMAIL", "TELEFONO", "DNI", "CIF", "NSS", "PASAPORTE",
  "IMPORTE", "CUENTA", "TARJETA", "DIRECCION", "MATRICULA", "FECHA", "IP", "URL",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  PERSONA: "Personas",
  EMPRESA: "Empresas",
  EMAIL: "Emails",
  TELEFONO: "Teléfonos",
  DNI: "DNI/NIE",
  CIF: "CIF",
  NSS: "Seguridad Social",
  PASAPORTE: "Pasaportes",
  IMPORTE: "Importes",
  CUENTA: "Cuentas",
  TARJETA: "Tarjetas",
  DIRECCION: "Direcciones",
  MATRICULA: "Matrículas",
  FECHA: "Nacimiento",
  IP: "IP",
  URL: "URLs",
};

export const CATEGORY_HINTS: Record<Category, string> = {
  PERSONA: "Nombres y apellidos",
  EMPRESA: "Empresas y organizaciones",
  EMAIL: "Direcciones de correo",
  TELEFONO: "Español (con o sin +34) e internacional",
  DNI: "DNI y NIE, con puntos o guiones",
  CIF: "NIF de empresa con control válido",
  NSS: "Número de afiliación con control válido",
  PASAPORTE: "Número tras «pasaporte»",
  IMPORTE: "Cantidades con €, EUR o 1.500,00",
  CUENTA: "IBAN completo o parcial y CCC",
  TARJETA: "13 a 19 dígitos que pasan Luhn",
  DIRECCION: "Calle, número, CP y ciudad",
  MATRICULA: "Formato actual: 1234 BCD",
  FECHA: "Fecha tras «nacido el» o «nacimiento»",
  IP: "Direcciones IPv4",
  URL: "Enlaces http(s) y www",
};

export const DEFAULT_CATEGORIES: Category[] = [...CATEGORIES];

const MODEL_CATEGORIES: Category[] = ["PERSONA", "EMPRESA", "DIRECCION"];

export const needsModel = (active: Iterable<Category>) =>
  [...active].some((c) => MODEL_CATEGORIES.includes(c));

export type Entities = { personas: string[]; empresas: string[]; direcciones: string[] };
export type MappingItem = { placeholder: string; original: string; category: Category };
export type Extractor = (text: string) => Promise<Entities>;

export class AnonymizeError extends Error {}

// User pressed Cancel: not shown as an error.
export class CancelledError extends AnonymizeError {
  constructor() {
    super("Anonimización cancelada.");
  }
}

// Session lists: values to always hide (with their category) and values to never hide.
export type Lists = { always: { value: string; category: Category }[]; never: string[] };

export type Options = { signal?: AbortSignal; onChunk?: (done: number, total: number) => void; lists?: Lists };

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
// Other countries: + prefix, 7 to 13 more digits.
const TELEFONO_INTL_RE = /(?<![\p{L}\p{N}_+])\+(?!34)\d{1,3}(?:[ \-]?\d){6,12}(?![\p{L}\p{N}_])/gu;

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'()]*[^\s<>"'().,;:!?]/g;
const IP_RE = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d]|\.\d)/g;

// Company NIF: org letter + 7 digits + control (digit or letter).
const CIF_RE = /(?<![\dA-Za-z])[ABCDEFGHJNPQRSUVW]-?\d{7}-?[\dA-J](?![\dA-Za-z])/g;
// Social security: province (2) + number (8) + control (2), with / - or spaces.
const NSS_RE = /(?<![\d/])\d{2}[ /\-]?\d{8}[ /\-]?\d{2}(?![\d/])/g;
// Cards: 13-19 digits, separators allowed. Luhn filters order numbers and the like.
const TARJETA_RE = /(?<!\d)\d(?:[ \-]?\d){12,18}(?!\d)/g;
const PASAPORTE_RE = /(?<=pasaporte\s*(?:(?:n[º°.o]?|número)\s*)?:?\s*)[A-Z]{2,3}\d{6,7}(?![\dA-Za-z])/gi;
// Current plates: no vowels, Ñ or Q.
const MATRICULA_RE = /(?<![\p{L}\p{N}])\d{4}[ \-]?[BCDFGHJKLMNPRSTVWXYZ]{3}(?![\p{L}\p{N}])/gu;
// Only birth dates (a contract date is not personal data).
const FECHA_RE =
  /(?<=(?:nacid[oa]s?|nacimiento|f\.\s?nac\.?)[\s:]*(?:el\s+|en\s+)?)(?:\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4})/gi;

const digits = (s: string) => s.replace(/\D/g, "");

export function luhn(s: string) {
  let sum = 0;
  for (const [i, d] of [...digits(s)].reverse().entries()) {
    const n = Number(d) * (i % 2 ? 2 : 1);
    sum += n > 9 ? n - 9 : n;
  }
  return sum % 10 === 0;
}

export function validCif(s: string) {
  const v = s.replace(/-/g, "").toUpperCase();
  const d = [...v.slice(1, 8)].map(Number);
  const sum = d.reduce((acc, n, i) => acc + (i % 2 ? n : Math.floor((n * 2) / 10) + ((n * 2) % 10)), 0);
  const c = (10 - (sum % 10)) % 10;
  return v[8] === String(c) || v[8] === "JABCDEFGHI"[c];
}

export function validNss(s: string) {
  const v = digits(s);
  const prov = Number(v.slice(0, 2));
  const num = Number(v.slice(2, 10));
  // Short numbers (< 10^7) are not concatenated with the province.
  const base = num < 1e7 ? num + prov * 1e7 : Number(v.slice(0, 10));
  return base % 97 === Number(v.slice(10));
}

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
// No quotes or cell separators (CSV) and never stop mid-word ("Gran Canari|a").
const DETALLE = String.raw`[^,\n.";|\t]{0,60}(?<!\s)(?![\p{L}\p{N}])`;
const VIA_DETALLE = String.raw`(?:\s*,\s*(?:\d${DETALLE}|${UP}${DETALLE}|(?:bajo|ático|entresuelo|principal|izquierda|derecha|izq|dcha|planta|puerta|piso|esc|pta)${DETALLE})){0,3}`;
const DIRECCION_RE = new RegExp(
  String.raw`${VIA}\s+${VIA_NOMBRE},?\s+(?:n[.ºo]?\s*)?\d{1,4}(?:\s?bis)?[A-Za-zºª]?${VIA_DETALLE}`,
  "gu",
);

// Optional check: a match that fails it is left as is.
type Rule = [Category, RegExp, ((m: string) => boolean)?];

// Before the model: the model already sees the placeholders.
// URL before email (mailto, query strings); accounts before cards; ids before phones.
const FIXED_RULES: Rule[] = [
  ["URL", URL_RE],
  ["EMAIL", EMAIL_RE],
  ["IP", IP_RE],
  ["DNI", DNI_RE],
  ["CIF", CIF_RE, validCif],
  ["PASAPORTE", PASAPORTE_RE],
  ["CUENTA", IBAN_RE],
  ["CUENTA", CCC_RE],
  ["TARJETA", TARJETA_RE, luhn],
  ["NSS", NSS_RE, validNss],
  ["FECHA", FECHA_RE],
  ["MATRICULA", MATRICULA_RE],
  ["IMPORTE", IMPORTE_RE],
  ["TELEFONO", TELEFONO_RE],
  ["TELEFONO", TELEFONO_INTL_RE],
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
  if (["TELEFONO", "DNI", "CIF", "NSS", "PASAPORTE", "CUENTA", "TARJETA", "MATRICULA"].includes(category))
    return v.replace(/[\s\-/]/g, "").toUpperCase();
  if (category === "IMPORTE") return v.replace(/\s/g, "");
  return v.replace(/\s+/g, " ").toLowerCase();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole words only: never inside another word or a placeholder ("[PERSONA_1]").
const wholeWord = (v: string) => new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(v)}(?![\\p{L}\\p{N}_])`, "gu");

function createMapper(never: string[] = []) {
  const counters = new Map<Category, number>();
  const byKey = new Map<string, string>();
  const mapping: MappingItem[] = [];

  const placeholderFor = (category: Category, original: string) => {
    if (never.some((t) => normalize(category, t) === normalize(category, original))) return null;
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
    rules.reduce(
      (t, [category, re, valid]) => t.replace(re, (m) => (valid && !valid(m) ? m : (placeholderFor(category, m) ?? m))),
      text,
    );

  // Longest first so overlapping entities don't break; whole words only.
  const applyEntities = (text: string, category: Category, values: string[]) => {
    const clean = [...new Set(values.map((v) => v.trim()))].filter((v) => v.length >= 2 && !v.startsWith("["));
    for (const v of clean.sort((a, b) => b.length - a.length)) {
      text = text.replace(wholeWord(v), (m) => placeholderFor(category, v) ?? m);
    }
    return text;
  };

  // Shorter forms of a full name share its placeholder.
  const applyAliases = (text: string, category: Category, aliases: [string, string][]) => {
    for (const [v, full] of aliases) text = text.replace(wholeWord(v), (m) => placeholderFor(category, full) ?? m);
    return text;
  };

  return { mapping, applyRegex, applyEntities, applyAliases };
}

const TITLES = ["Sr.", "Sra.", "Srta.", "D.", "Dña.", "Don", "Doña"];

// "Ana Pérez García" -> "Ana Pérez", "Pérez García", "Sra. Pérez"… Forms shared by two people are dropped.
export function nameVariants(names: string[]): [string, string][] {
  const full = [...new Set(names.map((n) => n.trim().replace(/\s+/g, " ")))];
  const fullKeys = new Set(full.map((n) => normalize("PERSONA", n)));
  const found = new Map<string, [string, string] | null>();
  for (const n of full) {
    const w = n.split(" ");
    if (w.length < 2) continue;
    const surnames = w.length >= 3 ? [w.slice(1).join(" "), w[1]] : [w[1]];
    const forms = surnames.flatMap((s) => TITLES.map((t) => `${t} ${s}`));
    if (w.length >= 3) forms.push(`${w[0]} ${w[1]}`, w.slice(1).join(" "));
    for (const f of forms) {
      const k = normalize("PERSONA", f);
      if (fullKeys.has(k)) continue;
      const prev = found.get(k);
      found.set(k, prev === undefined || prev?.[1] === n ? [f, n] : null);
    }
  }
  return [...found.values()].filter((v) => v !== null).sort((a, b) => b[0].length - a[0].length);
}

export async function anonymize(text: string, categories: Iterable<Category>, extract: Extractor, options: Options = {}) {
  const { signal, onChunk, lists = { always: [], never: [] } } = options;
  if (!text.trim()) throw new AnonymizeError("No hay texto para anonimizar.");
  const active = new Set(categories);
  if (!active.size) throw new AnonymizeError("Marca al menos una categoría que anonimizar.");

  const m = createMapper(lists.never);
  text = m.applyRegex(text, FIXED_RULES.filter(([c]) => active.has(c)));
  // Before the model, like regex: it already sees them hidden.
  for (const c of CATEGORIES)
    text = m.applyEntities(text, c, lists.always.filter((a) => a.category === c).map((a) => a.value));

  if (needsModel(active)) {
    const all: Entities = { personas: [], empresas: [], direcciones: [] };
    const parts = chunk(text);
    for (const [i, part] of parts.entries()) {
      onChunk?.(i, parts.length);
      const e = await extract(part);
      if (signal?.aborted) throw new CancelledError();
      all.personas.push(...e.personas);
      all.empresas.push(...e.empresas);
      all.direcciones.push(...e.direcciones);
    }
    if (active.has("PERSONA")) {
      text = m.applyEntities(text, "PERSONA", all.personas);
      text = m.applyAliases(text, "PERSONA", nameVariants(all.personas));
    }
    if (active.has("EMPRESA")) text = m.applyEntities(text, "EMPRESA", all.empresas);
    if (active.has("DIRECCION")) text = m.applyEntities(text, "DIRECCION", all.direcciones);
  }

  text = m.applyRegex(text, FALLBACK_RULES.filter(([c]) => active.has(c)));
  return renumber(text, m.mapping);
}

const PLACEHOLDER_RE = /\[([A-Z]+)_\d+\]/g;

export type Anonymized = { anonymized: string; mapping: MappingItem[] };

// Manual fix of a false positive: the placeholder goes back to its value everywhere.
export function revert(r: Anonymized, placeholder: string) {
  const item = r.mapping.find((m) => m.placeholder === placeholder);
  if (!item) return r;
  return renumber(r.anonymized.replaceAll(placeholder, item.original), r.mapping.filter((m) => m !== item));
}

// Manual fix of a miss: hide every whole-word occurrence of `value`.
export function hide(r: Anonymized, value: string, category: Category) {
  const v = value.trim();
  if (v.length < 2 || v.includes("[") || r.anonymized.search(wholeWord(v)) === -1) return r;
  const placeholder = `[${category}_${r.mapping.length + 1}]`;
  return renumber(r.anonymized.replace(wholeWord(v), placeholder), [...r.mapping, { placeholder, original: v, category }]);
}

// Rules run by category and longest value first; renumber by first appearance so [PERSONA_1] is the first person.
function renumber(text: string, mapping: MappingItem[]): Anonymized {
  const byOld = new Map(mapping.map((m) => [m.placeholder, m]));
  const counters = new Map<Category, number>();
  const next = new Map<string, MappingItem>();
  for (const [p] of text.matchAll(PLACEHOLDER_RE)) {
    const m = byOld.get(p);
    if (!m || next.has(p)) continue;
    const n = (counters.get(m.category) ?? 0) + 1;
    counters.set(m.category, n);
    next.set(p, { ...m, placeholder: `[${m.category}_${n}]` });
  }
  return {
    anonymized: text.replace(PLACEHOLDER_RE, (p) => next.get(p)?.placeholder ?? p),
    mapping: [...next.values()],
  };
}

// Back from the AI's reply: placeholders (and pseudonyms) in the mapping -> real values. Models sometimes lowercase placeholders.
export function restore(text: string, mapping: MappingItem[], fakes: Record<string, string> = {}) {
  const map = new Map(mapping.map((m) => [m.placeholder, m.original]));
  for (const [p, fake] of Object.entries(fakes).sort((a, b) => b[1].length - a[1].length)) {
    const original = map.get(p);
    if (original) text = text.replace(wholeWord(fake), () => original);
  }
  return text.replace(/\[([A-Za-z]+_\d+)\]/g, (p, id: string) => map.get(`[${id.toUpperCase()}]`) ?? p);
}

const FAKES: Partial<Record<Category, string[]>> = {
  PERSONA: [
    "Laura Ferrer", "Diego Navarro", "Irene Campos", "Hugo Vidal", "Nuria Prieto", "Óscar Molina", "Clara Ibáñez",
    "Raúl Cortés", "Alba Serrano", "Marcos Lozano", "Celia Rubio", "Iván Garrido", "Rocío Pastor", "Adrián Santos",
    "Eva Gallardo", "Jorge Castillo", "Inés Romero", "Samuel Vega", "Paula Herrera", "Gonzalo Peña",
  ],
  EMPRESA: [
    "Alfa Servicios S.L.", "Beta Logística S.A.", "Gamma Consultores S.L.", "Delta Comercial S.L.",
    "Épsilon Industrial S.A.", "Zeta Distribución S.L.", "Eta Ingeniería S.L.", "Theta Soluciones S.A.",
  ],
};
const FAKE_FALLBACK: Partial<Record<Category, string>> = { PERSONA: "Persona", EMPRESA: "Empresa" };

// Realistic stand-ins for people and companies, so the cloud AI reads natural text.
// Never a value already present in the text or the mapping, or restore() would be ambiguous.
export function pseudonyms(r: Anonymized) {
  const haystack = [r.anonymized, ...r.mapping.map((m) => m.original)].join("\n").toLowerCase();
  const used = new Map<Category, number>();
  const out: Record<string, string> = {};
  for (const m of r.mapping) {
    const pool = FAKES[m.category]?.filter((f) => !haystack.includes(f.toLowerCase()));
    if (!pool) continue;
    const i = used.get(m.category) ?? 0;
    used.set(m.category, i + 1);
    out[m.placeholder] = pool[i] ?? `${FAKE_FALLBACK[m.category]} ${i + 1}`;
  }
  return out;
}

export const withPseudonyms = (text: string, fakes: Record<string, string>) =>
  text.replace(PLACEHOLDER_RE, (p) => fakes[p] ?? p);

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
