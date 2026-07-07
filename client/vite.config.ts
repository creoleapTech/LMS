import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { resolve } from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'html2canvas': 'html2canvas-pro',
    },
    // Force a single React instance — prevents duplicate React from FFmpeg or other packages
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {

            // Only React core packages in vendor-react to avoid circular deps
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
              return 'vendor-react';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-tanstack';
            }
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('@tiptap') || id.includes('prosemirror')) {
              return 'vendor-tiptap';
            }
            if (id.includes('pdfjs-dist') || id.includes('react-pageflip')) {
              return 'vendor-pdf';
            }
            if (id.includes('xlsx') || id.includes('docx')) {
              return 'vendor-office';
            }
            if (id.includes('highlight.js')) {
              return 'vendor-highlight';
            }
            if (id.includes('cmdk')) {
              return 'vendor-cmdk';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            if (id.includes('sonner') || id.includes('class-variance') || id.includes('tailwind-merge') || id.includes('clsx')) {
              return 'vendor-ui-utils';
            }
            // No catch-all — remaining deps stay in their consuming chunks to avoid circular chunk deps
          }
        },
      },
    },
  },
})