import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    target: 'node16',
    lib: {
      entry: path.resolve(__dirname, 'src/extension.ts'),
      formats: ['es'],
      fileName: () => 'extension.js',
    },
    outDir: path.resolve(__dirname, 'dist'),
    rollupOptions: {
      external: [
        'vscode', // VS Code API
        /^node:/, // All node: prefixed modules
      ],
      output: {
        format: 'cjs',
      },
    },
    emptyOutDir: false,
    minify: false,
  },

  resolve: {
    extensions: ['.ts', '.js'],
  },

  // THIS IS KEY - tell Vite we're building for Node.js, not browser
  ssr: {
    target: 'node',
  },

  define: {
    // Prevent browser polyfills
    global: 'globalThis',
  },
})
