"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { MappingItem } from "@/lib/anonymize";

export function Placeholder({ item }: { item: MappingItem }) {
  return <mark className="ph">{item.placeholder}</mark>;
}

export function CopyButton({ text, className }: { text: string; className: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={!text}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

export type Notice = { kind: "info" | "warn" | "error"; text: string };

const noticeClass = {
  info: "border-border bg-muted text-muted-foreground",
  warn: "border-warn/30 bg-warn/10 text-warn",
  error: "border-bad/30 bg-bad/10 text-bad",
};

export function NoticeBox({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p role={notice.kind === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${noticeClass[notice.kind]}`}>
      {notice.text}
    </p>
  );
}
