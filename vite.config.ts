import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// @ts-ignore
const _dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    target: 'node20',
    lib: {
      entry: path.resolve(_dirname, 'src/extension.ts'),
      formats: ['es'],
      fileName: () => 'extension.js',
    },
    outDir: path.resolve(_dirname, 'dist'),
    rollupOptions: {
      external: ['vscode', /^node:.*/, '@vscode-ripgrep'],
      treeshake: true,
      output: {
        format: 'cjs',
      },
    },
    sourcemap: true,
    minify: false,
    emptyOutDir: true,
  },

  ssr: {
    target: 'node',
  },

  define: {
    // Prevent browser polyfills
    global: 'globalThis',
  },
})
