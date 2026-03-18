import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import * as vscode from 'vscode'

export class IndexStorage {
  public constructor(private readonly _context: vscode.ExtensionContext) {}

  public getIsAvailable(): boolean {
    return this._context.storageUri !== undefined
  }

  public getIndexDirectoryUri(contextRootFsPath: string): vscode.Uri {
    const { storageUri } = this._context
    if (!storageUri) {
      throw new Error(
        'Index storage is unavailable because no workspace is open (storageUri undefined).'
      )
    }

    const hash = createHash('sha256').update(contextRootFsPath).digest('hex').slice(0, 16)
    return vscode.Uri.joinPath(storageUri, 'bm25-index', hash)
  }

  public async writeJsonFile(
    directoryUri: vscode.Uri,
    fileName: string,
    jsonText: string
  ): Promise<void> {
    await vscode.workspace.fs.createDirectory(directoryUri)
    const fileUri = vscode.Uri.joinPath(directoryUri, fileName)
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(jsonText, 'utf8'))
  }

  public async readJsonFile(
    directoryUri: vscode.Uri,
    fileName: string
  ): Promise<string | undefined> {
    const fileUri = vscode.Uri.joinPath(directoryUri, fileName)
    try {
      const bytes = await vscode.workspace.fs.readFile(fileUri)
      return Buffer.from(bytes).toString('utf8')
    } catch {
      return undefined
    }
  }
}
