import { CodeXml } from "lucide-react";

// Pixel heart with the Canary Islands flag, same as hectorolisan's other projects.
function Heart() {
  return (
    <svg width="13" height="12" viewBox="0 0 13 12" aria-hidden className="shrink-0">
      <clipPath id="heart-canarias">
        <path d="M2 0h3v1H2zm6 0h3v1H8zM1 1h5v1H1zm6 0h5v1H7zM0 2h13v1H0zm0 1h13v1H0zm0 1h13v1H0zm1 1h11v1H1zm1 1h9v1H2zm1 1h7v1H3zm1 1h5v1H4zm1 1h3v1H5zm1 1h1v1H6z" />
      </clipPath>
      <g clipPath="url(#heart-canarias)">
        <path fill="#fff" d="M0 0h4v12H0z" />
        <path fill="#0768a9" d="M4 0h5v12H4z" />
        <path fill="#fc0" d="M9 0h4v12H9z" />
      </g>
    </svg>
  );
}

export function Credit() {
  return (
    <p className="flex flex-wrap items-center justify-center gap-1.5 font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
      <Heart />
      Desarrollado por
      <a
        href="https://hectorolisan.dev/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-1 underline-offset-2 transition-colors hover:text-foreground"
      >
        hectorolisan
      </a>
      <span aria-hidden>·</span>
      <a
        href="https://github.com/hectorolisan/anonymizer"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
      >
        <CodeXml className="size-3" aria-hidden />
        Código
      </a>
    </p>
  );
}
