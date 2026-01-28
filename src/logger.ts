import * as vscode from 'vscode'

export class Logger {
  private readonly _output: vscode.OutputChannel

  constructor() {
    this._output = vscode.window.createOutputChannel('BabaDeluxe AI Coder')
  }

  public log(message: string, ...args: unknown[]): void {
    const formatted = this._format('INFO', message, args)
    this._output.appendLine(formatted)
    console.log(formatted)
  }

  public warn(message: string, ...args: unknown[]): void {
    const formatted = this._format('WARN', message, args)
    this._output.appendLine(formatted)
    console.warn(formatted)
  }

  public error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    const formatted = this._format('ERROR', message, [error, ...args])
    this._output.appendLine(formatted)
    console.error(formatted, error)
  }

  public show(): void {
    this._output.show()
  }

  private _format(level: string, message: string, args: unknown[]): string {
    const timestamp = new Date().toISOString()
    const argsString = args.length > 0 ? ` ${JSON.stringify(args)}` : ''
    return `[${timestamp}] [${level}] ${message}${argsString}`
  }
}

export const logger = new Logger()
