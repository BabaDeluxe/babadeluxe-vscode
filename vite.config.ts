import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

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
      external: [
        'vscode',
        /^node:.*/,
        '@vscode/ripgrep',
        // Externalize all dependencies from package.json
        '@supabase/supabase-js',
        'colorino',
        'neverthrow',
        'p-queue',
        'stopword',
        'wink-bm25-text-search',
        'combine-async-iterators',
        /^@babadeluxe\//,
      ],
      treeshake: true,
      output: {
        format: 'es',
      },
    },
    sourcemap: 'inline',
    minify: false,
    emptyOutDir: true,
  },

  ssr: {
    target: 'node',
  },

  define: {
    global: 'globalThis',
  },
})
