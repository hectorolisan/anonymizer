export const PRIMARY_COLORS = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan",
  "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose", "neutral",
] as const;

export type PrimaryColor = (typeof PRIMARY_COLORS)[number];
export type Mode = "light" | "dark";

// tonos claros: texto oscuro encima para mantener contraste
const BRIGHT: readonly PrimaryColor[] = ["amber", "yellow", "lime"];

export function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento bloqueado: se pierde la preferencia, nada más */
  }
}

export function storedMode(): Mode {
  const m = read("theme");
  if (m === "light" || m === "dark") return m;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function storedPrimary(): PrimaryColor {
  const c = read("primary") as PrimaryColor | null;
  return c && PRIMARY_COLORS.includes(c) ? c : "teal";
}

export function primaryVars(c: PrimaryColor): Record<string, string> {
  const bright = BRIGHT.includes(c);
  return {
    "--primary-light": `var(--color-${c}-${bright ? 400 : 600})`,
    "--primary-fg-light": bright ? `var(--color-${c}-950)` : "var(--color-white)",
    "--primary-dark": `var(--color-${c}-500)`,
    "--primary-fg-dark": `var(--color-${c}-950)`,
  };
}

export function applyMode(mode: Mode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
  write("theme", mode);
}

export function applyPrimary(c: PrimaryColor) {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(primaryVars(c))) s.setProperty(k, v);
  write("primary", c);
}

// Runs in <head> before first paint (no flash). Mirrors storedMode/primaryVars.
export const THEME_SCRIPT = `(function(){var d=document.documentElement,t=null,p=null;
try{t=localStorage.getItem("theme");p=localStorage.getItem("primary")}catch(e){}
if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))d.classList.add("dark");
var v=${JSON.stringify(Object.fromEntries(PRIMARY_COLORS.map((c) => [c, primaryVars(c)])))}[p];
if(v)for(var k in v)d.style.setProperty(k,v[k]);})()`;
