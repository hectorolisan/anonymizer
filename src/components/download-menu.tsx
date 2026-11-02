"use client";

import { Download } from "lucide-react";
import { useRef } from "react";
import { anchorUnder } from "./ui";

const TYPES = {
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
} as const;

type Ext = keyof typeof TYPES;

// Blob URL: the file is built in the tab, nothing is uploaded.
export function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function DownloadMenu({ text, base, className }: { text: string; base: string; className: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  return (
    <>
      <button ref={trigger} type="button" popoverTarget="download-menu" disabled={!text} className={className}>
        <Download className="size-4" aria-hidden />
        Descargar
      </button>
      <div
        ref={list}
        id="download-menu"
        popover="auto"
        role="menu"
        aria-label="Formato de descarga"
        onBeforeToggle={(e) => e.newState === "open" && anchorUnder(trigger.current, e.currentTarget, "right")}
        className="card absolute inset-auto m-0 w-40 p-1 text-foreground"
      >
        {(Object.keys(TYPES) as Ext[]).map((ext) => (
          <button
            key={ext}
            type="button"
            role="menuitem"
            onClick={() => {
              download(text, `${base}.${ext}`, TYPES[ext]);
              list.current?.hidePopover();
            }}
            className="flex w-full rounded-md px-2.5 py-2 text-left font-mono text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            .{ext}
          </button>
        ))}
      </div>
    </>
  );
}
