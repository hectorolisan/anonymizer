import { describe, expect, it, vi } from "vitest";
import {
  anonymize,
  AnonymizeError,
  chunk,
  DEFAULT_CATEGORIES,
  needsModel,
  normalize,
  parseEntities,
  segments,
  type Category,
  type Entities,
} from "./anonymize";

const none: Entities = { personas: [], empresas: [], direcciones: [] };
const extractor = (e: Partial<Entities> = {}) => vi.fn(async () => ({ ...none, ...e }));
const only = (...c: Category[]) => c;

describe("regex", () => {
  it("emails, DNI/NIE, teléfonos e IBAN", async () => {
    const text =
      "Escribe a ana@ejemplo.com o llama al +34 612 345 678. DNI 45.812.339-K, NIE X1234567L. IBAN ES91 2100 0418 4502 0005 1332.";
    const { anonymized, mapping } = await anonymize(text, only("EMAIL", "DNI", "TELEFONO", "CUENTA"), extractor());
    expect(anonymized).toBe(
      "Escribe a [EMAIL_1] o llama al [TELEFONO_1]. DNI [DNI_1], NIE [DNI_2]. IBAN [CUENTA_1].",
    );
    // Mapping follows the order of appearance in the text.
    expect(mapping.map((m) => m.original)).toEqual([
      "ana@ejemplo.com", "+34 612 345 678", "45.812.339-K", "X1234567L", "ES91 2100 0418 4502 0005 1332",
    ]);
  });

  it("numera por orden de aparición aunque el modelo devuelva otro orden", async () => {
    const { anonymized, mapping } = await anonymize(
      "Firman Luis Martín y Ana Pérez García. Luis Martín paga.",
      only("PERSONA"),
      extractor({ personas: ["Ana Pérez García", "Luis Martín"] }),
    );
    expect(anonymized).toBe("Firman [PERSONA_1] y [PERSONA_2]. [PERSONA_1] paga.");
    expect(mapping.map((m) => [m.placeholder, m.original])).toEqual([
      ["[PERSONA_1]", "Luis Martín"],
      ["[PERSONA_2]", "Ana Pérez García"],
    ]);
  });

  it("respaldo de direcciones en CSV: no se come las comillas ni corta palabras", async () => {
    const { anonymized } = await anonymize(
      '"Ana","Avenida de Canarias 2, 2º izq, 35002 Las Palmas de Gran Canaria","ES91"\n"Luis","Calle Goya 1, 1º izq, 28001 Madrid","x"',
      only("DIRECCION"),
      extractor(),
    );
    expect(anonymized).toBe('"Ana","[DIRECCION_1]","ES91"\n"Luis","[DIRECCION_2]","x"');
  });

  it("cuenta de 20 dígitos e importes", async () => {
    const { anonymized } = await anonymize(
      "Cuenta 2100 0418 45 0200051332. Total 1.500,00 € y 300 euros, más EUR 20.",
      only("CUENTA", "IMPORTE"),
      extractor(),
    );
    expect(anonymized).toBe("Cuenta [CUENTA_1]. Total [IMPORTE_1] y [IMPORTE_2], más [IMPORTE_3].");
  });

  it("la misma entidad recibe siempre el mismo marcador", async () => {
    const { anonymized, mapping } = await anonymize(
      "ANA@ejemplo.com y ana@ejemplo.com; 612 345 678 = 612-345-678",
      only("EMAIL", "TELEFONO"),
      extractor(),
    );
    expect(anonymized).toBe("[EMAIL_1] y [EMAIL_1]; [TELEFONO_1] = [TELEFONO_1]");
    expect(mapping).toHaveLength(2);
  });

  it("deja intactas las categorías desmarcadas", async () => {
    const text = "ana@ejemplo.com, 612 345 678";
    const { anonymized } = await anonymize(text, only("EMAIL"), extractor());
    expect(anonymized).toBe("[EMAIL_1], 612 345 678");
  });

  it("respaldo: empresas con forma jurídica y direcciones", async () => {
    const { anonymized, mapping } = await anonymize(
      "Contrato con Talleres del Norte S.L. en Calle Goya 15, 3º izq, 28001 Madrid. Firma en C/ Alcalá 200.",
      only("EMPRESA", "DIRECCION"),
      extractor(),
    );
    expect(anonymized).toBe("Contrato con [EMPRESA_1] en [DIRECCION_1]. Firma en [DIRECCION_2].");
    expect(mapping[1].original).toBe("Calle Goya 15, 3º izq, 28001 Madrid");
  });
});

describe("modelo", () => {
  it("sustituye lo que devuelve el modelo, el más largo primero y por palabras completas", async () => {
    const extract = extractor({ personas: ["Ana", "Ana Pérez", "Inventada"], empresas: ["Cárnicas del Ebro S.A."] });
    const { anonymized, mapping } = await anonymize(
      "Ana Pérez trabaja en Cárnicas del Ebro S.A. Ana firma. Anabel no.",
      only("PERSONA", "EMPRESA"),
      extract,
    );
    expect(anonymized).toBe("[PERSONA_1] trabaja en [EMPRESA_1] [PERSONA_2] firma. Anabel no.");
    expect(mapping.find((m) => m.original === "Inventada")).toBeUndefined();
  });

  it("el modelo ve los marcadores de regex y no reemplaza dentro de ellos", async () => {
    const extract = extractor({ personas: ["EMAIL", "[EMAIL_1]"] });
    const { anonymized } = await anonymize("Correo: ana@ejemplo.com", DEFAULT_CATEGORIES, extract);
    expect(extract).toHaveBeenCalledWith("Correo: [EMAIL_1]");
    expect(anonymized).toBe("Correo: [EMAIL_1]");
  });

  it("no llama al modelo si no hay categorías suyas activas", async () => {
    const extract = extractor();
    await anonymize("hola", only("EMAIL"), extract);
    expect(extract).not.toHaveBeenCalled();
    expect(needsModel(only("EMAIL", "DNI"))).toBe(false);
    expect(needsModel(only("EMAIL", "PERSONA"))).toBe(true);
  });

  it("une las entidades de todos los trozos", async () => {
    const extract = vi
      .fn()
      .mockResolvedValueOnce({ ...none, personas: ["Ana"] })
      .mockResolvedValueOnce({ ...none, personas: ["Luis"] });
    const text = `Ana ${"x".repeat(1990)}\n${"y".repeat(100)} Luis`;
    const { anonymized } = await anonymize(text, only("PERSONA"), extract);
    expect(extract).toHaveBeenCalledTimes(2);
    expect(anonymized).toMatch(/^\[PERSONA_\d\] x+\ny+ \[PERSONA_\d\]$/);
  });

  it("errores de entrada", async () => {
    await expect(anonymize("  ", DEFAULT_CATEGORIES, extractor())).rejects.toThrow(AnonymizeError);
    await expect(anonymize("hola", [], extractor())).rejects.toThrow("al menos una categoría");
  });
});

describe("utilidades", () => {
  it("normalize", () => {
    expect(normalize("EMAIL", " A@B.ES ")).toBe("a@b.es");
    expect(normalize("DNI", "45.812.339-k")).toBe("45.812.339K");
    expect(normalize("PERSONA", "Ana   PÉREZ")).toBe("ana pérez");
  });

  it("segments solo resalta marcadores del mapa", () => {
    const item = { placeholder: "[EMAIL_1]", original: "a@b.es", category: "EMAIL" as const };
    expect(segments("Hola [EMAIL_1] y [EMAIL_2].", [item])).toEqual(["Hola ", item, " y [EMAIL_2]."]);
  });

  it("chunk respeta el máximo y no pierde texto", () => {
    const text = ["a".repeat(30), "b".repeat(30), "palabra ".repeat(10).trim()].join("\n");
    const parts = chunk(text, 40);
    expect(parts.every((p) => p.length <= 40)).toBe(true);
    expect(parts.join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });

  it("parseEntities tolera <think> y ruido, y valida la forma", () => {
    expect(parseEntities('<think>…</think> Vale: {"personas":["Ana"],"empresas":null} fin')).toEqual({
      personas: ["Ana"], empresas: [], direcciones: [],
    });
    expect(() => parseEntities("nada")).toThrow("sin JSON");
    expect(() => parseEntities('{"personas": "Ana"}')).toThrow("no es una lista");
    expect(() => parseEntities('{"personas": [')).toThrow("incompleto");
  });
});
