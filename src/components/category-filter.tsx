"use client";

import { ListFilter, X } from "lucide-react";
import { useRef } from "react";
import { CATEGORIES, CATEGORY_HINTS, CATEGORY_LABELS, type Category } from "@/lib/anonymize";
import { labelClass } from "@/lib/utils";
import { controlClass } from "./theme-controls";

type Props = { value: Category[]; onChange: (v: Category[]) => void };

const ghost =
  "h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export function CategoryFilter({ value, onChange }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const toggle = (c: Category) =>
    onChange(CATEGORIES.filter((x) => (x === c ? !value.includes(c) : value.includes(x))));

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={controlClass}>
        <ListFilter className="size-4" aria-hidden />
        Categorías
        <span className="rounded-md bg-primary/10 px-1.5 font-mono text-xs text-primary">
          {value.length}/{CATEGORIES.length}
        </span>
      </button>
      <dialog
        ref={ref}
        aria-labelledby="categories-title"
        // Click on the backdrop closes.
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="card m-auto w-[min(34rem,calc(100%-2rem))] p-0 text-foreground backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start gap-3 p-6 pb-4">
          <div className="mr-auto">
            <p className={labelClass}>Qué anonimizar</p>
            <h2 id="categories-title" className="mt-1 text-2xl">
              Categorías
            </h2>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <fieldset className="grid gap-1 px-4 sm:grid-cols-2">
          <legend className="sr-only">Categorías a anonimizar</legend>
          {CATEGORIES.map((c) => (
            <label key={c} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-muted">
              <input
                type="checkbox"
                checked={value.includes(c)}
                onChange={() => toggle(c)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">{CATEGORY_LABELS[c]}</span>
                <span className="block text-xs text-muted-foreground">{CATEGORY_HINTS[c]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-4 flex items-center gap-1 border-t px-6 py-4">
          <button type="button" onClick={() => onChange([...CATEGORIES])} className={`${ghost} -ml-3`}>
            Todas
          </button>
          <button type="button" onClick={() => onChange([])} className={ghost}>
            Ninguna
          </button>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="ml-auto h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Listo
          </button>
        </div>
      </dialog>
    </>
  );
}
