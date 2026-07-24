import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
