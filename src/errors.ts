import { BaseError } from '@babadeluxe/shared/utils'

// Infrastructure errors (logged in services)
export class RgSearchError extends BaseError {}
export class FileReadError extends BaseError {}

// Business logic errors (logged in handlers)
export class ContextBuildError extends BaseError {}

export class OAuthCallbackParseError extends BaseError {}

export class Bm25IndexConsolidationError extends BaseError {}
export class SidebarWebviewNotReadyError extends BaseError {}

export class ContextCommandError extends BaseError {}
