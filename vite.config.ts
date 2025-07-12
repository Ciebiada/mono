/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/mono/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      sourcemap: false,
    },
  },
});
