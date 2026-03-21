import path from 'node:path'
import { inspect } from 'node:util'
import * as vscode from 'vscode'
import { createColorino, themePalettes } from 'colorino'

type ColorinoLogger = ReturnType<typeof createColorino>
type ColorinoLogLevel = keyof Omit<Omit<ColorinoLogger, 'gradient'>, 'colorize'>

type LogMetadata = Readonly<{
  colorinoLevel: ColorinoLogLevel
  levelLabel: string
}>

type OutputFormatData = Readonly<{
  timestamp: string
  level: string
  context: string
}>

type LoggerMethod = (contextTag: string, message: string, ...args: any[]) => void

export class Logger {
  private readonly _output: vscode.OutputChannel
  private readonly _logger: ColorinoLogger

  constructor() {
    this._output = vscode.window.createOutputChannel('BabaDeluxe AI Coder')
    this._logger = createColorino(themePalettes['catppuccin-mocha'])
  }

  public log(message: string, ...args: unknown[]): void {
    this._log({ colorinoLevel: 'info', levelLabel: 'INFO' }, message, args)
  }

  public info(message: string, ...args: unknown[]): void {
    this._log({ colorinoLevel: 'info', levelLabel: 'INFO' }, message, args)
  }

  public debug(message: string, ...args: unknown[]): void {
    this._log({ colorinoLevel: 'debug', levelLabel: 'DEBUG' }, message, args)
  }

  public warn(message: string, ...args: unknown[]): void {
    this._log({ colorinoLevel: 'warn', levelLabel: 'WARN' }, message, args)
  }

  public trace(message: string, ...args: unknown[]): void {
    this._log({ colorinoLevel: 'trace', levelLabel: 'TRACE' }, message, args)
  }

  public error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    const combinedArgs = error === undefined ? args : [error, ...args]
    this._log({ colorinoLevel: 'error', levelLabel: 'ERROR' }, message, combinedArgs)
  }

  public show(): void {
    this._output.show()
  }

  private _log(metadata: LogMetadata, message: string, args: unknown[]): void {
    const timestamp = new Date().toISOString()
    const context = this._getCallerContext()

    this._output.appendLine(
      this._formatForOutputChannel(
        { timestamp, level: metadata.levelLabel, context },
        message,
        args
      )
    )

    if (args.length === 0) {
      this._logger[metadata.colorinoLevel](`[${context}]`, message)
      return
    }

    ;(this._logger[metadata.colorinoLevel] as LoggerMethod)(`[${context}]`, message, ...args)
  }

  private _formatForOutputChannel(
    data: OutputFormatData,
    message: string,
    args?: unknown[]
  ): string {
    if (!args || args.length === 0) {
      return `[${data.timestamp}] [${data.level}] [${data.context}] ${message}`
    }

    const argsText = inspect(args, {
      depth: 6,
      colors: false,
      compact: true,
      breakLength: 140,
    })

    return `[${data.timestamp}] [${data.level}] [${data.context}] ${message} ${argsText}`
  }

  private _getCallerContext(): string {
    const originalPrepareStackTrace = Error.prepareStackTrace

    try {
      Error.prepareStackTrace = (_, stack) => stack

      // Adjusted stack index:
      // 0: Error creation
      // 1: _getCallerContext
      // 2: _log
      // 3: public log method (e.g., info/debug)
      // 4: The actual caller
      const stack = new Error('Stack trace for caller detection')
        .stack as unknown as NodeJS.CallSite[]

      const caller = stack[4]
      const fileName = caller?.getFileName()

      if (!fileName) return 'unknown'

      return path.basename(fileName, path.extname(fileName))
    } finally {
      Error.prepareStackTrace = originalPrepareStackTrace
    }
  }
}

export const logger = new Logger()
