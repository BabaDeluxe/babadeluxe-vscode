import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['./tests/**/*.spec.ts'],
    setupFiles: ['./tests/setup.ts'],
    alias: {
      vscode: path.resolve(_dirname, './tests/mocks/vscode.ts'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['./src/**/*.ts'],
    },
    server: {
      deps: {
        inline: ['reactive-vscode'],
      },
    },
    mockReset: true,
    restoreMocks: true,
  },
})
