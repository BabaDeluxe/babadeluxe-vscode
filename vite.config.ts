import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { parseAllCommandFiles, type CommandManifest } from './scripts/command-manifest-reader.js'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

type PackageJson = {
  [key: string]: unknown
  contributes?: Record<string, unknown>
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as unknown
}

function stableJsonStringify(value: unknown): string {
  return `${JSON.stringify(value, undefined, 2)}\n`
}

async function writeFileIfChanged(filePath: string, nextContent: string): Promise<void> {
  let currentContent: string | undefined
  try {
    currentContent = await fs.readFile(filePath, 'utf8')
  } catch {
    currentContent = undefined
  }

  if (currentContent === nextContent) return
  await fs.writeFile(filePath, nextContent, 'utf8')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function buildContributesFromManifests(manifests: readonly CommandManifest[]): {
  commands: unknown[]
  menus: Record<string, unknown[]>
} {
  const commands: unknown[] = []
  const menus: Record<string, unknown[]> = {}

  for (const manifest of manifests) {
    const commandContribution: Record<string, unknown> = {
      command: manifest.commandId,
      title: manifest.title,
    }

    if (manifest.icon) commandContribution['icon'] = manifest.icon
    commands.push(commandContribution)

    const manifestMenus = manifest.menus
    if (!manifestMenus) continue

    for (const menuLocation of Object.keys(manifestMenus)) {
      const menuItems = manifestMenus[menuLocation] ?? []
      menus[menuLocation] ||= []

      for (const menuItem of menuItems) {
        menus[menuLocation].push({
          command: manifest.commandId,
          ...menuItem,
        })
      }
    }
  }

  return { commands, menus }
}

function syncExtensionManifestPlugin(): Plugin {
  const basePath = path.resolve(_dirname, 'package.base.json')
  const outPath = path.resolve(_dirname, 'package.json')

  const ignoredBasenames = new Set([
    'helper.ts',
    'types.ts',
    'register-lazy-commands.ts',
    'registry.ts',
    'generated-registry.ts',
  ])

  return {
    name: 'sync-extension-manifest',
    apply: 'build',
    async buildStart() {
      const baseUnknown = await readJsonFile(basePath)
      if (!isRecord(baseUnknown)) {
        throw new Error('package.base.json must contain a JSON object at the top level.')
      }

      const commandsDirectory = path.resolve(_dirname, 'src', 'commands')
      const registryEntries = await parseAllCommandFiles({ commandsDirectory, ignoredBasenames })
      const generated = buildContributesFromManifests(
        registryEntries.map((entry) => entry.manifest)
      )

      const base = baseUnknown as PackageJson
      const contributes: Record<string, unknown> = {
        ...(isRecord(base.contributes) ? base.contributes : {}),
        commands: generated.commands,
        menus: generated.menus,
      }

      const next: PackageJson = {
        ...base,
        contributes,
      }

      await writeFileIfChanged(outPath, stableJsonStringify(next))
    },
  }
}

export default defineConfig({
  plugins: [syncExtensionManifestPlugin()],

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
        '@supabase/supabase-js',
        'colorino',
        'neverthrow',
        'p-queue',
        'stopword',
        'wink-bm25-text-search',
        /^@babadeluxe\//,
      ],
      treeshake: true,
      output: { format: 'es' },
    },
    sourcemap: 'inline',
    minify: false,
    emptyOutDir: true,
  },

  ssr: { target: 'node' },

  define: { global: 'globalThis' },
})
