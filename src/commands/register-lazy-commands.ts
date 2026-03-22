import type { CommandDependencies, LazyCommandEntry, ExtensionCommand } from './types.js'

export function registerLazyCommands(options: {
  dependencies: CommandDependencies
  entries: readonly LazyCommandEntry[]
}): Record<string, (...args: unknown[]) => Promise<void>> {
  const commandInstancePromisesByCommandId = new Map<string, Promise<ExtensionCommand>>()
  const handlersByCommandId: Record<string, (...args: unknown[]) => Promise<void>> = {}

  const getCommandInstance = async (entry: LazyCommandEntry): Promise<ExtensionCommand> => {
    const cached = commandInstancePromisesByCommandId.get(entry.manifest.commandId)
    if (cached) return cached

    const instancePromise = (async (): Promise<ExtensionCommand> => {
      const module = await entry.load()
      // eslint-disable-next-line new-cap
      return new module()
    })()

    commandInstancePromisesByCommandId.set(entry.manifest.commandId, instancePromise)
    return instancePromise
  }

  for (const entry of options.entries) {
    handlersByCommandId[entry.manifest.commandId] = async (...args: unknown[]) => {
      const command = await getCommandInstance(entry)
      await command.run(options.dependencies, ...args)
    }
  }

  return handlersByCommandId
}
