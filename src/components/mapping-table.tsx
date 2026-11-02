import { ChevronRight } from "lucide-react";
import { CATEGORY_LABELS, type MappingItem } from "@/lib/anonymize";
import { Placeholder } from "./ui";

export function MappingTable({ mapping }: { mapping: MappingItem[] }) {
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-primary transition-transform group-open:rotate-90" aria-hidden />
        <h2 className="text-lg">Mapa de equivalencias</h2>
        <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-xs text-primary-foreground">{mapping.length}</span>
      </summary>
      <div className="overflow-x-auto border-t px-5 pb-5">
        {mapping.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-3 pr-4 font-medium">Marcador</th>
                <th className="py-3 pr-4 font-medium">Valor original</th>
                <th className="py-3 font-medium">Categoría</th>
              </tr>
            </thead>
            <tbody>
              {mapping.map((m) => (
                <tr key={m.placeholder} className="border-b last:border-0">
                  <td className="py-2.5 pr-4">
                    <Placeholder item={m} />
                  </td>
                  <td className="py-2.5 pr-4 break-all">{m.original}</td>
                  <td className="py-2.5 text-muted-foreground">{CATEGORY_LABELS[m.category]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="pt-4 text-sm text-muted-foreground">
            Aún no hay equivalencias. Vive solo en esta pestaña: al cerrarla desaparece.
          </p>
        )}
      </div>
    </details>
  );
}
