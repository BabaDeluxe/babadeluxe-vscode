import * as vscode from 'vscode'
import { GrowthBook } from '@growthbook/growthbook'

export function initGrowthBook() {
  const clientKey = process.env.GROWTHBOOK_CLIENT_KEY ?? ''

  const gb = new GrowthBook({
    apiHost: 'https://cdn.growthbook.io',
    clientKey,
    enableDevMode: true,
    subscribeToChanges: true,
    attributes: {
      id: vscode.env.machineId,
      language: vscode.env.language,
      version: vscode.version,
      app: 'vscode-extension'
    },
    trackingCallback: (experiment, result) => {
      // In a real scenario, this would send data to an analytics provider
      // For now, we log it to the internal logger if possible, or console
      console.log('Experiment Viewed', {
        experimentId: experiment.key,
        variationId: result.key,
      })
    },
  })

  return gb
}
