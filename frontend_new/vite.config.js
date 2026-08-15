import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Runs on its own port so the redesigned frontend_new can coexist with the
  // original frontend (5173) during the redesign.
  server: { port: 5174 },
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
