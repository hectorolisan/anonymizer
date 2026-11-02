import type { MetadataRoute } from "next";

// Static export: relative URLs resolve against the manifest, so they work under any basePath.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anonimizador",
    short_name: "Anonimizador",
    description: "Oculta datos personales en local antes de usar una IA.",
    lang: "es",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#0d9488",
    icons: [
      { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
