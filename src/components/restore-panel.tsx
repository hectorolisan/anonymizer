"use client";

import { useState } from "react";
import { restore, type MappingItem } from "@/lib/anonymize";
import { labelClass } from "@/lib/utils";
import { CopyButton } from "./ui";

const area = "min-h-32 w-full rounded-lg border bg-transparent px-3 py-2 text-sm leading-7";

export function RestorePanel({ mapping }: { mapping: MappingItem[] }) {
  const [reply, setReply] = useState("");
  const restored = restore(reply, mapping);

  return (
    <section aria-labelledby="restore-title" className="card px-5 py-4">
      <h2 id="restore-title" className={labelClass}>
        Restaurar respuesta
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Pega la respuesta de la IA con los marcadores y recupera los datos reales.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <textarea
          aria-label="Respuesta de la IA"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Pega aquí la respuesta…"
          className={`${area} resize-y outline-none placeholder:text-muted-foreground focus-visible:border-primary`}
        />
        <output data-testid="restored" className={`${area} overflow-auto whitespace-pre-wrap`}>
          {restored || <span className="text-muted-foreground">Aquí aparecerá con los datos reales.</span>}
        </output>
      </div>
      <div className="mt-3 flex justify-end">
        <CopyButton
          text={restored}
          className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        />
      </div>
    </section>
  );
}
