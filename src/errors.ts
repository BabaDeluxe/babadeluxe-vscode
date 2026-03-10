import { BaseError } from '@babadeluxe/shared/utils'

// Infrastructure errors (logged in services): IO, filesystem, process execution, scan mechanics.
export class RgSearchError extends BaseError {}
export class FileReadError extends BaseError {}

// Business logic errors (logged in handlers): use-case orchestration/pipeline steps.
export class ContextBuildError extends BaseError {}
export class Bm25IndexConsolidationError extends BaseError {}
export class ContextCommandError extends BaseError {}
export class ContextPinsStoreError extends BaseError {}

// Integration/boundary errors: external protocols or UI lifecycle/state boundaries.
export class OAuthCallbackParseError extends BaseError {}
export class SidebarWebviewNotReadyError extends BaseError {}
export class SignInError extends BaseError {}
export class InitializationError extends BaseError {}

// Infrastructure errors (logged in services): folder scan/traversal failures.
// Note: even if these extend BaseError directly, they’re still “infrastructure” concerns (filesystem + scan control-flow).
export class FolderReadDirectoryError extends BaseError {}
export class FolderScanQueueError extends BaseError {}
