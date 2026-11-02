import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No server: everything runs in the browser.
  output: "export",
  // GitHub Pages serves the repo under /<repo>; set by the deploy workflow.
  basePath: process.env.PAGES_BASE_PATH,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
