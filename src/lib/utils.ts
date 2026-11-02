import type { Category } from "./anonymize";

// Brand section label: Poppins 600, uppercase, 0.3em tracking.
export const labelClass = "text-[11px] font-semibold tracking-[0.3em] uppercase text-muted-foreground";

// One validated categorical colour per category (globals.css --series-*).
export const CATEGORY_COLORS: Record<Category, string> = {
  PERSONA: "var(--series-1)",
  EMPRESA: "var(--series-7)",
  EMAIL: "var(--series-3)",
  TELEFONO: "var(--series-2)",
  DNI: "var(--series-8)",
  IMPORTE: "var(--series-4)",
  DIRECCION: "var(--series-5)",
  CUENTA: "var(--series-6)",
};
