import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

export type CommandMenuItem = Readonly<Record<string, unknown>>

export type CommandManifest = Readonly<{
  commandId: string
  title: string
  icon?: string
  menus?: Readonly<Record<string, readonly CommandMenuItem[]>>
}>

export type RegistryEntry = Readonly<{
  sourceFilename: string
  manifestText: string
  manifest: CommandManifest
  commandClassName: string
  modulePathJs: string
}>

const toPosixPath = (value: string) => value.split(path.sep).join('/')

const hasExportModifier = (node: { modifiers?: ts.NodeArray<ts.ModifierLike> }): boolean =>
  node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false

const isStringKey = (
  name: ts.PropertyName
): name is ts.Identifier | ts.StringLiteral | ts.NumericLiteral =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)

const getPropertyKey = (name: ts.PropertyName): string => {
  if (!isStringKey(name)) throw new Error('Unsupported manifest key (computed/spread).')
  return ts.isIdentifier(name) ? name.text : name.text
}

const evaluateExpression = (sourceFile: ts.SourceFile, expression: ts.Expression): unknown => {
  void sourceFile

  if (ts.isStringLiteralLike(expression)) return expression.text
  if (ts.isNumericLiteral(expression)) return Number(expression.text)
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null

  if (ts.isIdentifier(expression) && expression.text === 'undefined') return undefined

  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.map((element) => evaluateExpression(sourceFile, element))
  }

  if (ts.isObjectLiteralExpression(expression)) {
    const record: Record<string, unknown> = {}

    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error('Unsupported manifest object property (spread/shorthand/method).')
      }

      const key = getPropertyKey(property.name)
      record[key] = evaluateExpression(sourceFile, property.initializer)
    }

    return record
  }

  throw new Error(`Unsupported manifest value expression: ${ts.SyntaxKind[expression.kind]}`)
}

const getObjectLiteralText = (sourceFile: ts.SourceFile, expression: ts.Expression): string => {
  if (!ts.isObjectLiteralExpression(expression)) {
    throw new Error('Manifest initializer is not an object literal.')
  }

  return expression.getText(sourceFile)
}

const findExportedManifest = (
  sourceFile: ts.SourceFile
): { manifestText: string; manifest: CommandManifest } | undefined => {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    if (!hasExportModifier(statement)) continue

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue
      if (!declaration.name.text.endsWith('Manifest')) continue
      if (!declaration.initializer) continue

      const manifestText = getObjectLiteralText(sourceFile, declaration.initializer)
      const manifestUnknown = evaluateExpression(sourceFile, declaration.initializer)

      if (typeof manifestUnknown !== 'object' || manifestUnknown === null) {
        throw new Error('Manifest did not evaluate to an object.')
      }

      const manifestRecord = manifestUnknown as Record<string, unknown>
      if (
        typeof manifestRecord['commandId'] !== 'string' ||
        typeof manifestRecord['title'] !== 'string'
      ) {
        throw new TypeError('Manifest must contain commandId and title strings.')
      }

      return { manifestText, manifest: manifestUnknown as CommandManifest }
    }
  }

  return undefined
}

const findExportedCommandClass = (sourceFile: ts.SourceFile): { className: string } | undefined => {
  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement)) continue
    if (!hasExportModifier(statement)) continue
    if (!statement.name) continue
    if (!ts.isIdentifier(statement.name)) continue
    if (!statement.name.text.endsWith('Command')) continue

    return { className: statement.name.text }
  }

  return undefined
}

export async function getCommandFiles(options: {
  commandsDirectory: string
  ignoredBasenames: ReadonlySet<string>
}): Promise<string[]> {
  const entries = await fs.readdir(options.commandsDirectory, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.ts'))
    .filter((name) => !options.ignoredBasenames.has(name))
    .sort((left, right) => left.localeCompare(right))
}

export async function parseOneCommandFile(options: {
  commandsDirectory: string
  filename: string
}): Promise<RegistryEntry> {
  const fullPath = path.join(options.commandsDirectory, options.filename)
  const sourceText = await fs.readFile(fullPath, 'utf8')

  const sourceFile = ts.createSourceFile(
    fullPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )

  const manifest = findExportedManifest(sourceFile)
  const commandClass = findExportedCommandClass(sourceFile)

  if (!manifest) throw new Error(`Missing exported *Manifest in: ${toPosixPath(fullPath)}`)
  if (!commandClass) throw new Error(`Missing exported *Command class in: ${toPosixPath(fullPath)}`)

  return {
    sourceFilename: options.filename,
    manifestText: manifest.manifestText,
    manifest: manifest.manifest,
    commandClassName: commandClass.className,
    modulePathJs: `./${path.basename(options.filename, '.ts')}.js`,
  }
}

export async function parseAllCommandFiles(options: {
  commandsDirectory: string
  ignoredBasenames: ReadonlySet<string>
}): Promise<readonly RegistryEntry[]> {
  const commandFiles = await getCommandFiles(options)

  return Promise.all(
    commandFiles.map(async (filename) =>
      parseOneCommandFile({ commandsDirectory: options.commandsDirectory, filename })
    )
  )
}
