import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/geist-mono/latin-400.css";
import "@fontsource/geist-mono/latin-500.css";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anonimizador",
  description: "Oculta datos personales en local antes de usar una IA. Funciona en el navegador con WebGPU.",
};

const dev = process.env.NODE_ENV === "development";

// GitHub Pages sends no headers, so the policy goes in <meta>. The page may only talk to itself and
// to the model hosts: the text cannot be sent anywhere else. Inline scripts: Next's static payload.
// shortcut: workers get their own (header) policy, so the WebLLM worker is not covered by this one.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com${dev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // THEME_SCRIPT sets class/style on <html> before hydration.
    <html lang="es" className="h-full" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
      </head>
      {/* Extensions (e.g. ColorZilla) inject attributes on <body> before hydration. */}
      <body className="min-h-full" suppressHydrationWarning>
        {children}
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
      </body>
    </html>
  );
}
