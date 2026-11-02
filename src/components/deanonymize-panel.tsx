"use client";

import { useState } from "react";
import { deanonymize, type MappingItem } from "@/lib/anonymize";
import { CopyButton } from "./ui";

export function DeanonymizePanel({ mapping }: { mapping: MappingItem[] }) {
  const [input, setInput] = useState("");
  const output = mapping.length && input.trim() ? deanonymize(input, mapping) : "";

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="deanon-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="deanon-title" className="text-lg">
            Des-anonimizar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pega la respuesta de la IA con los marcadores y recupera los valores reales.
          </p>
        </div>
        <CopyButton text={output} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <textarea
          aria-label="Respuesta con marcadores"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!mapping.length}
          placeholder={mapping.length ? "Pega aquí la respuesta con [PERSONA_1], [EMAIL_1]…" : "Anonimiza un texto primero"}
          className="min-h-40 resize-y rounded-lg border bg-background p-4 text-sm leading-7 outline-none placeholder:text-muted-foreground focus-visible:border-primary disabled:opacity-60"
        />
        <output
          aria-label="Texto con los valores reales"
          className="min-h-40 rounded-lg border bg-muted/50 p-4 text-sm leading-7 whitespace-pre-wrap"
        >
          {output || <span className="text-muted-foreground">Aquí verás el texto con los valores reales.</span>}
        </output>
      </div>
    </section>
  );
}
