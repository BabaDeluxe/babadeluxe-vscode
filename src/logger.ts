import path from 'node:path'
import { inspect } from 'node:util'
import * as vscode from 'vscode'
import { createColorino, themePalettes } from 'colorino'

/**
 * Type inferred from the factory return type.
 * This ensures we stay synced with the library's API without maintaining manual interfaces.
 */
type ColorinoLogger = ReturnType<typeof createColorino>

type ColorinoLogLevel = keyof Omit<Omit<ColorinoLogger, 'gradient'>, 'colorize'>

export class Logger {
  private readonly _output: vscode.OutputChannel
  private readonly _logger: ColorinoLogger

  constructor() {
    this._output = vscode.window.createOutputChannel('BabaDeluxe AI Coder')
    this._logger = createColorino(themePalettes['catppuccin-mocha'])
  }

  // Backwards compatible with your existing API.
  public log(message: string, ...args: unknown[]): void {
    this.info(message, ...args)
  }

  public info(message: string, ...args: unknown[]): void {
    this._log('info', 'INFO', message, args)
  }

  public debug(message: string, ...args: unknown[]): void {
    this._log('debug', 'DEBUG', message, args)
  }

  public warn(message: string, ...args: unknown[]): void {
    this._log('warn', 'WARN', message, args)
  }

  public trace(message: string, ...args: unknown[]): void {
    this._log('trace', 'TRACE', message, args)
  }

  public error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    const combinedArgs = error === undefined ? args : [error, ...args]
    this._log('error', 'ERROR', message, combinedArgs)
  }

  public show(): void {
    this._output.show()
  }

  private _log(
    level: ColorinoLogLevel,
    levelLabel: string,
    message: string,
    args: unknown[]
  ): void {
    const timestamp = new Date().toISOString()
    const context = this._getCallerContext()

    // OutputChannel: keep it plain text (no ANSI color codes).
    this._output.appendLine(
      this._formatForOutputChannel(timestamp, levelLabel, context, message, args)
    )

    // Console: Colorino handles coloring by level.
    if (args.length === 0) {
      this._logger[level](`[${context}]`, message)
      return
    }

    this._logger[level](`[${context}]`, message, ...args)
  }

  // eslint-disable-next-line
  private _formatForOutputChannel(
    timestamp: string,
    level: string,
    context: string,
    message: string,
    args: unknown[]
  ): string {
    if (args.length === 0) {
      return `[${timestamp}] [${level}] [${context}] ${message}`
    }

    const argsText = inspect(args, {
      depth: 6,
      colors: false,
      compact: true,
      breakLength: 140,
    })

    return `[${timestamp}] [${level}] [${context}] ${message} ${argsText}`
  }

  /**
   * Introspects the V8 Call Stack to find the file name of the caller.
   *
   * Stack Index Logic (matches the example's structure):
   * [0]: _getCallerContext
   * [1]: _log
   * [2]: the public logger method (info/warn/error/...)
   * [3]: the consumer calling the logger <--- Target
   */
  private _getCallerContext(): string {
    const originalPrepareStackTrace = Error.prepareStackTrace

    try {
      Error.prepareStackTrace = (_, stack) => stack

      const stack = new Error('Stack trace for caller detection')
        .stack as unknown as NodeJS.CallSite[]

      const caller = stack[3]
      const fileName = caller?.getFileName()

      if (!fileName) {
        return 'unknown'
      }

      return path.basename(fileName, path.extname(fileName))
    } finally {
      Error.prepareStackTrace = originalPrepareStackTrace
    }
  }
}

export const logger = new Logger()
