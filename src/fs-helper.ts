import { promises as fs, type Dirent } from 'node:fs'
import path from 'node:path'
import combine from 'combine-async-iterators'

type Logger = {
  readonly log: (message: string) => void
}

export class FileSystemManager {
  constructor(private readonly _logger: Logger = console) {}

  public async createDirectory(directoryPath: string): Promise<void> {
    try {
      await fs.mkdir(directoryPath, { recursive: true } as const)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
    }
  }

  public async writeFile(filePath: string, data: string | Uint8Array): Promise<void> {
    await fs.writeFile(filePath, data)
  }

  public async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8' as const)
  }

  public async readDirectory(
    directoryPath: string,
    withFileTypes?: boolean
  ): Promise<Dirent[] | string[]> {
    if (withFileTypes) {
      return fs.readdir(directoryPath, { withFileTypes: true } as const)
    }

    return fs.readdir(directoryPath)
  }

  public async appendFile(filePath: string, data: string | Uint8Array): Promise<void> {
    await fs.appendFile(filePath, data)
  }

  public async *getFiles(directory: string): AsyncGenerator<string, void> {
    const items = await fs.readdir(directory, { withFileTypes: true })

    for (const item of items) {
      const itemPath = path.join(directory, item.name)

      if (item.isDirectory()) {
        yield* this.getFiles(itemPath)
      } else {
        yield itemPath
      }
    }
  }

  public async getAllFiles(...directories: readonly string[]): Promise<readonly string[]> {
    if (directories.length === 0) {
      throw new Error('At least one directory path is required')
    }

    const generators = directories.map((directory: string) => this.getFiles(directory))
    const files: string[] = []

    for await (const file of combine(...generators)) {
      files.push(file)
    }

    return Object.freeze(files)
  }

  public async createFolder(folderPath: string): Promise<void> {
    try {
      await fs.access(folderPath)
    } catch {
      await this.createDirectory(folderPath)
      this._logger.log(`Created new folder ${folderPath}`)
    }
  }
}

const defaultFileSystemManager = new FileSystemManager()

export const createDirectory =
  defaultFileSystemManager.createDirectory.bind(defaultFileSystemManager)
export const writeFile = defaultFileSystemManager.writeFile.bind(defaultFileSystemManager)
export const readFile = defaultFileSystemManager.readFile.bind(defaultFileSystemManager)
export const getFiles = defaultFileSystemManager.getFiles.bind(defaultFileSystemManager)
export const getAllFiles = defaultFileSystemManager.getAllFiles.bind(defaultFileSystemManager)
