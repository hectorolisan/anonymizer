<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project

**Anonimizador** replaces sensitive data (names, companies, emails, phones, DNI/NIE, amounts,
addresses, bank accounts) with colour placeholders like `[PERSONA_1]` before pasting a text into a
cloud AI, and lists which real value each placeholder hides. Everything runs in the browser: regex plus an LLM
on WebGPU via WebLLM (`@mlc-ai/web-llm`). Next.js 16 static export + React 19 + Tailwind CSS 4, no
backend. Port of [beailabs/anonimizador](https://github.com/beailabs/anonimizador) (Python + Ollama).
All visible content is in Spanish. Vitest covers `src/lib` and `AnonymizerApp` (`*.test.ts(x)`,
engine mocked; DOM tests opt into jsdom with `// @vitest-environment jsdom`).

## Commands

pnpm is the package manager (`pnpm-lock.yaml` is committed; npm/bun also work).

- `pnpm install` — install dependencies
- `pnpm dev` — dev server at localhost:3000
- `pnpm build` — static export to `./out/`
- `pnpm lint` — ESLint (`eslint-config-next` core-web-vitals + typescript)
- `pnpm test` — Vitest (`vitest run`; `vitest.config.mts` only maps the `@/` alias, default env is node)

Deploy: `.github/workflows/deploy.yml` publishes `./out/` to GitHub Pages on every push to `main`
(lint + test first). `basePath` comes from `PAGES_BASE_PATH` (`/anonymizer` in CI, empty locally), so
never hardcode root-relative asset URLs.

`pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (no package published less than a day ago)
and blocks build scripts for `sharp` / `unrs-resolver` — keep both when adding dependencies.

## Architecture

`src/app/page.tsx` renders `<AnonymizerApp />` (`src/components/anonymizer-app.tsx`), a client
component with the header (model status + theme controls), input card, result card, mapping table
and `Credit` footer. State lives in `src/hooks/use-anonymizer.ts`; the pipeline is
`src/lib/anonymize.ts`; the model layer is `src/lib/engine.ts`; file reading is `src/lib/extract.ts`.

Patterns that span files:

- **No server, ever**: `next.config.ts` sets `output: "export"`. No route handlers, server actions,
  `cookies()` or `next/image` optimisation. Nothing is persisted: the mapping lives only in React
  state and disappears with the tab. Don't add storage for texts or mappings.
- **Pipeline** (`anonymize()`): 1) `FIXED_RULES` regex (email, DNI/NIE, IBAN/CCC, amounts, phones)
  so the model already sees placeholders; 2) the model extracts `personas` / `empresas` /
  `direcciones` only if one of those categories is active (`needsModel`), over `chunk()`s of
  ~2000 chars because the context window is 4096 tokens; 3) `FALLBACK_RULES` regex (companies with
  legal form, street + number) for what the model missed. Model values are replaced longest first,
  whole words only, and ignored if not literally in the text (hallucinations).
- **Placeholders**: `[CATEGORY_N]`, numbered per category; `normalize()` is the dedup key so the same
  entity always gets the same placeholder. `segments()` highlights only placeholders present in the
  mapping (not ones typed in the original). The mapping table is the only way back from a
  placeholder to its real value.
- **Engine in a Web Worker**: `engine.ts` lazily creates one `WebWorkerMLCEngine` backed by
  `engine.worker.ts`; `loadModel()` is a no-op when the model is already loaded. `extractEntities()`
  uses `response_format: json_object` with `ENTITIES_SCHEMA`, `temperature: 0`, Qwen3 thinking off,
  then `parseEntities()` validates; one retry, then an `AnonymizeError` — never a half-anonymised
  text. `MODEL_IDS` must be exact ids from WebLLM's `prebuiltAppConfig` (unknown ids are dropped).
- **Errors**: `AnonymizeError` / `ExtractionError` messages are user-facing Spanish; anything else is
  wrapped as a generic browser error in `use-anonymizer.ts`. Without WebGPU the regex-only
  categories still work; model categories show an error.
- **File extraction**: `.txt`/`.md` via `File.text()`, `.docx` via `mammoth`, `.pdf` via `pdfjs-dist`
  (worker as `workerPort`), both dynamically imported. No OCR: empty PDFs raise a "scanned" notice.
- **SSR-safe browser checks**: `hasWebGPU` is read through `useSyncExternalStore` with a server
  snapshot of `true`; `ThemeControls` (reads `localStorage`/`matchMedia`) only renders after mount.
- **Design tokens**: same system as `analytics-dashboard`. Tailwind 4 with no `tailwind.config` —
  everything is in `src/app/globals.css`: neutral surfaces, `--primary` set by `lib/theme.ts` from the
  picked colour (teal by default), `good`/`bad`/`warn`, and the CVD-validated `--series-*` palette,
  one per category via `CATEGORY_COLORS` in `lib/utils.ts` (`ph` utility reads `--c`). Light/dark is
  the `.dark` class; `THEME_SCRIPT` applies mode and primary in `<head>` before first paint. Fonts are
  self-hosted with Fontsource: Poppins (`font-sans`), Bricolage Grotesque (`font-heading`, h1–h3),
  Geist Mono (`font-mono`). Use these tokens, not hardcoded colours.
