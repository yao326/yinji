import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";



export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), VitePWA({
    registerType: "autoUpdate",
    workbox: {
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
    },
    includeAssets: ["icon.svg"],
    manifest: {
      name: "印迹 Yinji",
      short_name: "印迹",
      description: "把走过的路，印在地球上。",
      theme_color: "#07111f",
      background_color: "#07111f",
      display: "standalone",
      start_url: ".",
      icons: [
        {
          src: "icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable"
        }
      ]
    }
  })],
  server: {
    host: true
  }
});