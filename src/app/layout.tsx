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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // THEME_SCRIPT sets class/style on <html> before hydration.
    <html lang="es" className="h-full" suppressHydrationWarning>
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
