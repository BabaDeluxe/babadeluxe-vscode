import * as path from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import * as vscode from 'vscode'
import type { API as GitApi, GitExtension, Repository } from 'typings/git'

const execFileAsync = promisify(execFile)

type GitRecencyCacheEntry = {
  lastCommitTimestampMs: number
}

export class GitRecencyService {
  private readonly _gitApi?: GitApi
  private readonly _repository?: Repository
  private readonly _cache = new Map<string, GitRecencyCacheEntry>()
  private readonly _pending = new Map<string, Promise<GitRecencyCacheEntry | undefined>>()

  public constructor(private readonly _workspaceRootFsPath: string) {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')
    if (!gitExtension) return

    const ext = gitExtension.isActive ? gitExtension.exports : gitExtension.activate()

    const api = ext && 'getAPI' in ext ? ext.getAPI(1) : undefined
    if (!api) return

    this._gitApi = api

    // Naive repo pick: first repo whose root contains our workspace root
    const repo = api.repositories.find((repo: Repository) =>
      this._isDescendant(this._workspaceRootFsPath, repo.rootUri.fsPath)
    )
    this._repository = repo
  }

  public isAvailable(): boolean {
    return Boolean(this._gitApi && this._repository)
  }

  public getCachedTimestamp(filePath: string): number | undefined {
    return this._cache.get(filePath)?.lastCommitTimestampMs
  }

  public async ensureTimestamp(filePath: string): Promise<number | undefined> {
    const cached = this._cache.get(filePath)
    if (cached) return cached.lastCommitTimestampMs

    if (!this._repository) return undefined

    const relPath = this._toRepoRelativePath(filePath)
    if (!relPath) return undefined

    const pending = this._pending.get(filePath)
    if (pending) {
      const entry = await pending
      return entry?.lastCommitTimestampMs
    }

    // eslint-disable-next-line promise/prefer-await-to-then
    const promise = this._fetchLastCommitForPath(relPath).finally(() => {
      this._pending.delete(filePath)
    })
    this._pending.set(filePath, promise)

    const entry = await promise
    if (!entry) return undefined

    this._cache.set(filePath, entry)
    return entry.lastCommitTimestampMs
  }

  private async _fetchLastCommitForPath(
    repoRelativePath: string
  ): Promise<GitRecencyCacheEntry | undefined> {
    const repoRoot = this._repository!.rootUri.fsPath

    try {
      const { stdout } = await execFileAsync(
        'git',
        ['log', '-1', '--format=%ct', '--', repoRelativePath],
        {
          cwd: repoRoot,
          maxBuffer: 1024 * 8,
        }
      )

      const trimmed = stdout.trim()
      if (!trimmed) return undefined

      const seconds = Number.parseInt(trimmed, 10)
      if (!Number.isFinite(seconds)) return undefined

      return { lastCommitTimestampMs: seconds * 1000 }
    } catch {
      return undefined
    }
  }

  private _isDescendant(child: string, parent: string): boolean {
    const relative = path.relative(parent, child)
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative)
  }

  private _toRepoRelativePath(absolutePath: string): string | undefined {
    const repoRoot = this._repository?.rootUri.fsPath
    if (!repoRoot) return undefined
    if (!this._isDescendant(absolutePath, repoRoot) && absolutePath !== repoRoot) {
      return undefined
    }

    return path.relative(repoRoot, absolutePath).replaceAll('\\', '/')
  }
}
