# Anonimizador

Hide sensitive data **before** pasting a text into a cloud AI, and get it back afterwards.
Everything runs **100% in the browser**: regex plus an LLM on the GPU via WebGPU — no server, no API keys, the text never leaves the tab.

- **Next.js 16** — static export (`output: "export"`), no backend.
- **WebLLM** (`@mlc-ai/web-llm`) — in-browser inference on WebGPU, inside a Web Worker, with JSON-schema constrained output.
- **Tailwind CSS 4** — design tokens, light/dark mode and selectable primary color (teal by default).
- **mammoth** + **pdfjs-dist** — local text extraction from `.docx` and `.pdf`.
- **Fontsource** — self-hosted fonts.
- **Vitest** + **Testing Library** — unit and component tests.
- **pnpm** — package manager.

> Requires a browser with WebGPU (e.g. recent Chrome or Edge) for names, companies and addresses. The other categories work without it.

![cover](./public/cover.webp)

## What it detects

| Category    | Detection                                                         | Placeholder     |
| :---------- | :---------------------------------------------------------------- | :-------------- |
| Personas    | Model                                                             | `[PERSONA_1]`   |
| Empresas    | Model + regex fallback for legal forms (S.L., S.A., S.Coop.…)     | `[EMPRESA_1]`   |
| Emails      | Regex                                                             | `[EMAIL_1]`     |
| Teléfonos   | Regex, Spanish format with optional +34/0034 and separators       | `[TELEFONO_1]`  |
| DNI/NIE     | Regex, dots and dashes allowed                                    | `[DNI_1]`       |
| Importes    | Regex, €/EUR/euros or Spanish thousands format (1.500,00)         | `[IMPORTE_1]`   |
| Direcciones | Model + regex fallback for street type + number                   | `[DIRECCION_1]` |
| Cuentas     | Regex, full or partial IBAN and 20-digit CCC                      | `[CUENTA_1]`    |

- The same entity always gets the **same placeholder**.
- Chips choose **which categories** to anonymize (all but amounts by default).
- The placeholder → value map is shown in a collapsible table and lives **only in the tab**.
- **Des-anonimizar**: paste the AI's answer with placeholders to restore the real values.
- Models: Qwen3 1.7B, Qwen3 4B (default) and Llama 3.2 3B, downloaded once and cached by the browser.

## Project Structure

```
/
├── public/
│   └── cover.webp
├── src/
│   ├── app/
│   │   ├── globals.css             # Tailwind + design tokens
│   │   ├── icon.svg
│   │   ├── layout.tsx              # <html>, fonts, theme script + metadata
│   │   └── page.tsx                # Renders <AnonymizerApp />
│   ├── components/
│   │   ├── anonymizer-app.tsx      # Header, input, result and layout
│   │   ├── credit.tsx              # Footer credit
│   │   ├── deanonymize-panel.tsx   # Restore real values
│   │   ├── mapping-table.tsx       # Placeholder → original table
│   │   ├── model-status.tsx        # Model selector + WebGPU/download status
│   │   ├── theme-controls.tsx      # Light/dark + primary color picker
│   │   └── ui.tsx                  # Placeholder chip, copy button, notices
│   ├── hooks/
│   │   └── use-anonymizer.ts       # Model loading + anonymize state
│   └── lib/
│       ├── anonymize.ts            # Regex rules, prompt, dedup, chunks, de-anonymize
│       ├── engine.ts               # Model list + WebLLM engine + entity extraction
│       ├── engine.worker.ts        # Web Worker running the engine
│       ├── extract.ts              # .txt / .md / .docx / .pdf → text
│       ├── theme.ts                # Theme + primary color persistence
│       └── utils.ts
├── .github/workflows/deploy.yml    # Lint + test + GitHub Pages
├── AGENTS.md
├── LICENSE
├── next.config.ts
├── package.json
└── README.md
```

## Available Scripts

| Command        | Action                                                  |
| :------------- | :------------------------------------------------------ |
| `pnpm install` | Install all dependencies                                |
| `pnpm dev`     | Start dev server at `localhost:3000`                    |
| `pnpm build`   | Build static site into `./out/`, deployable on any host |
| `pnpm lint`    | Run ESLint                                              |
| `pnpm test`    | Run Vitest                                              |

> You can also use `npm` or `bun` if you prefer.

---

Developed by Héctor Olivares Sánchez.
Inspired by [anonimizador](https://github.com/beailabs/anonimizador) by beailabs.
