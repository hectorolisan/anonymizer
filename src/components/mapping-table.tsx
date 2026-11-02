import { Undo2 } from "lucide-react";
import { CATEGORY_LABELS, type MappingItem } from "@/lib/anonymize";
import { labelClass } from "@/lib/utils";
import { CopyButton, Placeholder } from "./ui";

type Props = { mapping: MappingItem[]; fakes: Record<string, string>; onRevert: (m: MappingItem) => void };

export function MappingTable({ mapping, fakes, onRevert }: Props) {
  return (
    <section aria-labelledby="mapping-title" className="card px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="mapping-title" className={labelClass}>
          Equivalencias · {mapping.length}
        </h2>
        {/* TSV: pastes as columns in a spreadsheet. */}
        <CopyButton
          label="Copiar tabla"
          text={mapping.map((m) => [fakes[m.placeholder] ?? m.placeholder, m.original, CATEGORY_LABELS[m.category]].join("\t")).join("\n")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-3.5"
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Solo existen en esta pestaña: al cerrarla desaparecen.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sr-only">
            <tr>
              <th>Marcador</th>
              <th>Valor original</th>
              <th>Categoría</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mapping.map((m) => (
              <tr key={m.placeholder}>
                <td className="w-0 py-2 pr-6 whitespace-nowrap">
                  <Placeholder item={m} label={fakes[m.placeholder]} />
                </td>
                <td className="py-2 pr-6 break-all">{m.original}</td>
                <td className="w-0 py-2 text-right whitespace-nowrap text-muted-foreground">
                  {CATEGORY_LABELS[m.category]}
                </td>
                <td className="w-0 py-2 pl-3">
                  <button
                    type="button"
                    onClick={() => onRevert(m)}
                    aria-label={`No anonimizar «${m.original}»`}
                    title="No anonimizar"
                    className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Undo2 className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
