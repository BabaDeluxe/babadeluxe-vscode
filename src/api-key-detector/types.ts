import { BaseError } from '@babadeluxe/shared/utils'

export type DetectedApiKey = {
  readonly provider: string
  readonly key: string
  readonly source: 'user-settings' | 'workspace-settings' | 'dot-vscode-settings'
}

export type DetectorResult = ReadonlyArray<DetectedApiKey>

export class DetectionError extends BaseError {}
