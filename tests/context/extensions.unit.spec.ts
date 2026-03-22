import { describe, it, expect } from 'vitest'
import {
  isIndexableFileExtension,
  indexableFileIncludeGlobs,
  indexableFileWatcherGlob,
} from '../../src/system/extensions.js'

describe('isIndexableFileExtension', () => {
  it('returns true for any file with an extension', () => {
    expect(isIndexableFileExtension('test.ts')).toBe(true)
    expect(isIndexableFileExtension('test.js')).toBe(true)
    expect(isIndexableFileExtension('test.py')).toBe(true)
    expect(isIndexableFileExtension('test.tsx')).toBe(true)
    expect(isIndexableFileExtension('test.vue')).toBe(true)
    expect(isIndexableFileExtension('test.xyz')).toBe(true)
    expect(isIndexableFileExtension('data.csv')).toBe(true)
    expect(isIndexableFileExtension('image.svg')).toBe(true)
  })

  it('returns false for .d.ts files', () => {
    expect(isIndexableFileExtension('types.d.ts')).toBe(false)
    expect(isIndexableFileExtension('global.D.TS')).toBe(false)
    expect(isIndexableFileExtension('/path/to/index.d.ts')).toBe(false)
  })

  it('returns false for minified files', () => {
    expect(isIndexableFileExtension('bundle.min.js')).toBe(false)
    expect(isIndexableFileExtension('styles.min.css')).toBe(false)
    expect(isIndexableFileExtension('jquery.min.map')).toBe(false)
  })

  it('returns false for lock files', () => {
    expect(isIndexableFileExtension('package-lock.json')).toBe(false)
    expect(isIndexableFileExtension('composer-lock.json')).toBe(false)
    expect(isIndexableFileExtension('pnpm-lock.yaml')).toBe(false)
    expect(isIndexableFileExtension('yarn.lock')).toBe(false)
  })

  it('handles case insensitively', () => {
    expect(isIndexableFileExtension('Test.TS')).toBe(true)
    expect(isIndexableFileExtension('TEST.JS')).toBe(true)
    expect(isIndexableFileExtension('Types.D.TS')).toBe(false)
  })

  it('works with absolute paths', () => {
    expect(isIndexableFileExtension('/src/components/Button.tsx')).toBe(true)
    expect(isIndexableFileExtension(String.raw`C:\projects\app.ts`)).toBe(true)
    expect(isIndexableFileExtension('/lib/index.d.ts')).toBe(false)
  })

  it('returns false for files without extension', () => {
    expect(isIndexableFileExtension('README')).toBe(false)
    expect(isIndexableFileExtension('Makefile')).toBe(false)
    expect(isIndexableFileExtension('Dockerfile')).toBe(false)
  })
})

describe('indexableFileIncludeGlobs', () => {
  it('includes all files', () => {
    expect(indexableFileIncludeGlobs).toContain('**/*')
  })
})

describe('indexableFileWatcherGlob', () => {
  it('watches all files', () => {
    expect(indexableFileWatcherGlob).toBe('**/*')
  })
})
