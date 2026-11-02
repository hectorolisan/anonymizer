import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No server: everything runs in the browser.
  output: "export",
  // GitHub Pages serves the repo under /<repo>; set by the deploy workflow.
  basePath: process.env.PAGES_BASE_PATH,
  // The service worker URL needs it at runtime.
  env: { NEXT_PUBLIC_BASE_PATH: process.env.PAGES_BASE_PATH ?? "" },
};

export default nextConfig;
