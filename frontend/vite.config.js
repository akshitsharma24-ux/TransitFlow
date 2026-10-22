import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// In a production build the maplibre-gl chunk asks for
// assets/maplibre-gl-worker.mjs (and the shared module it imports) next to
// itself, but the bundler never emits them, so the deployed map has no
// basemap tiles or route lines (404 on the worker). Copy both files into
// the build output where the library expects them. Dev is handled by
// optimizeDeps.exclude below.
const emitMaplibreWorker = () => ({
  name: "emit-maplibre-worker",
  apply: "build",
  generateBundle() {
    for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
      this.emitFile({
        type: "asset",
        fileName: `assets/${file}`,
        source: fs.readFileSync(new URL(`./node_modules/maplibre-gl/dist/${file}`, import.meta.url)),
      });
    }
  },
});

export default defineConfig({
  // maplibre-gl loads its tile-decoding worker via a dynamically constructed
  // Worker URL. Vite's esbuild-based dep pre-bundler doesn't follow that
  // pattern correctly, so the prebundled copy ends up requesting a
  // "maplibre-gl-worker.mjs" that was never emitted (404 at runtime) — the
  // map's sources then never finish loading. Excluding it from
  // optimizeDeps makes Vite serve it as real ESM instead, which resolves
  // the worker correctly.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  plugins: [
    react(),
    emitMaplibreWorker(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "TransitFlow — Mumbai Route Comparison",
        short_name: "TransitFlow",
        description: "Compare local train, metro, bus, and road routes across Mumbai based on what matters to you.",
        theme_color: "#14213D",
        background_color: "#F4F6F5",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precaches the app shell (JS/CSS/HTML) so it opens instantly on
        // repeat visits. API calls to your backend still need network —
        // this is app-shell offline support, not full offline routing.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
});
