/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
    })
  ],
  optimizeDeps: {
    exclude: [
      '@tiptap/pm',
      '@tiptap/core',
      '@tiptap/extension-task-item',
      '@tiptap/extension-task-list',
      '@tiptap/react',
      '@tiptap/starter-kit'
    ],
    esbuildOptions: {
      sourcemap: false
    }
  },
  worker: {
    rollupOptions: {
    }
  }
})
