import * as vscode from 'vscode'
import { RgContextBuilder } from './rg-context-builder.js'
import { VsCodeSignalProvider } from './signal-provider.js'
import { AutoContextHandler } from './auto-context-handler.js'
import { resolveContextRootFsPath } from './workspace-root.js'
import { acquireBm25Runtime } from './bm25-runtime-registry.js'
import type { Bm25RuntimeHandle } from './types.js'

export class AutoContextSession {
  private _contextHandler?: AutoContextHandler
  private _lastWorkspaceRoot?: string
  private _bm25RuntimeHandle?: Bm25RuntimeHandle

  public constructor(private readonly _context: vscode.ExtensionContext) {}

  public dispose(): void {
    this._contextHandler = undefined
    this._lastWorkspaceRoot = undefined

    this._bm25RuntimeHandle?.dispose()
    this._bm25RuntimeHandle = undefined
  }

  public getHandler(): AutoContextHandler | undefined {
    return this._contextHandler
  }

  public getRoot(): string | undefined {
    return this._lastWorkspaceRoot
  }

  public async ensureInitialized(rootOverride?: string): Promise<void> {
    const root =
      rootOverride ?? resolveContextRootFsPath(vscode.window.activeTextEditor?.document.uri)

    if (!root) {
      this.dispose()
      return
    }

    const isRootChanged = this._lastWorkspaceRoot !== root
    if (!isRootChanged && this._contextHandler) return

    if (isRootChanged) {
      this._bm25RuntimeHandle?.dispose()
      this._bm25RuntimeHandle = undefined
      this._lastWorkspaceRoot = root
    }

    const contextBuilder = new RgContextBuilder(root, 20)
    const signalProvider = new VsCodeSignalProvider(root)

    this._bm25RuntimeHandle = await acquireBm25Runtime(this._context, root)
    this._contextHandler = new AutoContextHandler(
      root,
      contextBuilder,
      signalProvider,
      this._bm25RuntimeHandle?.bm25IndexService
    )
  }
}
