// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { applyMode, applyPrimary, storedPrimary, THEME_SCRIPT } from "./theme";

const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root.removeAttribute("style");
  root.className = "";
});

describe("theme", () => {
  it("teal por defecto e ignora valores no válidos", () => {
    expect(storedPrimary()).toBe("teal");
    localStorage.setItem("primary", "chartreuse");
    expect(storedPrimary()).toBe("teal");
  });

  it("aplica y persiste el color primario", () => {
    applyPrimary("rose");
    expect(root.style.getPropertyValue("--primary-light")).toBe("var(--color-rose-600)");
    expect(root.style.getPropertyValue("--primary-fg-light")).toBe("var(--color-white)");
    expect(storedPrimary()).toBe("rose");
  });

  it("usa texto oscuro sobre tonos claros", () => {
    applyPrimary("yellow");
    expect(root.style.getPropertyValue("--primary-light")).toBe("var(--color-yellow-400)");
    expect(root.style.getPropertyValue("--primary-fg-light")).toBe("var(--color-yellow-950)");
  });

  it("alterna la clase dark", () => {
    applyMode("dark");
    expect(root.classList.contains("dark")).toBe(true);
    applyMode("light");
    expect(root.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("el script inicial aplica modo y color guardados", () => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem("primary", "violet");
    new Function(THEME_SCRIPT)();
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.getPropertyValue("--primary-dark")).toBe("var(--color-violet-500)");
  });
});
