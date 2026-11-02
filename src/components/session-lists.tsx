"use client";

import { ListPlus, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { CATEGORIES, CATEGORY_LABELS, type Category, type Lists } from "@/lib/anonymize";
import { labelClass } from "@/lib/utils";
import { controlClass } from "./theme-controls";

type Props = { value: Lists; onChange: (v: Lists) => void };

const input =
  "h-9 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary";
const addBtn = "h-9 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted";
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Only one list per value: adding it to one removes it from the other.
export function addAlways(l: Lists, value: string, category: Category): Lists {
  if (!value.trim()) return l;
  return {
    always: [...l.always.filter((a) => !same(a.value, value)), { value: value.trim(), category }],
    never: l.never.filter((n) => !same(n, value)),
  };
}

export function addNever(l: Lists, value: string): Lists {
  if (!value.trim()) return l;
  return {
    always: l.always.filter((a) => !same(a.value, value)),
    never: [...l.never.filter((n) => !same(n, value)), value.trim()],
  };
}

function Chip({ text, hint, onRemove }: { text: string; hint?: string; onRemove: () => void }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-md bg-muted py-1 pr-1 pl-2.5 text-sm">
      {text}
      {hint && <span className="text-xs text-muted-foreground">· {hint}</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar «${text}»`}
        className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-card hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

export function SessionLists({ value, onChange }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [always, setAlways] = useState("");
  const [category, setCategory] = useState<Category>("PERSONA");
  const [never, setNever] = useState("");
  const count = value.always.length + value.never.length;

  const submit = (e: FormEvent, fn: () => void) => {
    e.preventDefault();
    fn();
  };

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={controlClass}>
        <ListPlus className="size-4" aria-hidden />
        Listas
        {count > 0 && <span className="rounded-md bg-primary/10 px-1.5 font-mono text-xs text-primary">{count}</span>}
      </button>
      <dialog
        ref={ref}
        aria-labelledby="lists-title"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="card m-auto w-[min(34rem,calc(100%-2rem))] p-0 text-foreground backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start gap-3 p-6 pb-2">
          <div className="mr-auto">
            <p className={labelClass}>Solo en esta pestaña</p>
            <h2 id="lists-title" className="mt-1 text-2xl">
              Listas
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

        <div className="space-y-6 px-6 pb-6">
          <section aria-labelledby="always-title">
            <h3 id="always-title" className="text-base">
              Anonimizar siempre
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Se tapan aunque el modelo no los detecte.</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) =>
                submit(e, () => {
                  onChange(addAlways(value, always, category));
                  setAlways("");
                })
              }
            >
              <input
                aria-label="Valor a anonimizar siempre"
                value={always}
                onChange={(e) => setAlways(e.target.value)}
                placeholder="Proyecto Faro"
                className={input}
              />
              <select
                aria-label="Categoría"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="h-9 rounded-lg border bg-card px-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <button type="submit" className={addBtn}>
                Añadir
              </button>
            </form>
            <ul className="mt-3 flex flex-wrap gap-2">
              {value.always.map((a) => (
                <Chip
                  key={a.value}
                  text={a.value}
                  hint={CATEGORY_LABELS[a.category]}
                  onRemove={() => onChange({ ...value, always: value.always.filter((x) => x !== a) })}
                />
              ))}
            </ul>
          </section>

          <section aria-labelledby="never-title">
            <h3 id="never-title" className="text-base">
              No anonimizar nunca
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Falsos positivos: se dejan tal cual.</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) =>
                submit(e, () => {
                  onChange(addNever(value, never));
                  setNever("");
                })
              }
            >
              <input
                aria-label="Valor a no anonimizar nunca"
                value={never}
                onChange={(e) => setNever(e.target.value)}
                placeholder="Santa Cruz"
                className={input}
              />
              <button type="submit" className={addBtn}>
                Añadir
              </button>
            </form>
            <ul className="mt-3 flex flex-wrap gap-2">
              {value.never.map((n) => (
                <Chip key={n} text={n} onRemove={() => onChange({ ...value, never: value.never.filter((x) => x !== n) })} />
              ))}
            </ul>
          </section>
        </div>
      </dialog>
    </>
  );
}
