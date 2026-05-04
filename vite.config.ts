import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path, { resolve } from 'path'
import packageJson from './package.json'

const host = process.env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // @toast-ui/editor is a large monolithic dependency loaded lazily with Notes page.
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'quick-pane': resolve(__dirname, 'quick-pane.html'),
      },
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return

          const normalized = id.replace(/\\/g, '/')
          const modulePath = normalized.split('node_modules/')[1]
          if (!modulePath) return

          const parts = modulePath.split('/')
          const packageName =
            parts[0].startsWith('@') && parts.length > 1
              ? `${parts[0]}/${parts[1]}`
              : parts[0]

          if (
            packageName === 'react' ||
            packageName === 'react-dom' ||
            packageName === 'scheduler'
          ) {
            return 'vendor-react-core'
          }

          return `vendor-${packageName.replace(/[@/]/g, '-')}`
        },
      },
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}))
