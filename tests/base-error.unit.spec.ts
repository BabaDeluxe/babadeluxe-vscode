import { BaseError } from '@babadeluxe/shared'
import { describe, it, expect } from 'vitest'

class TestError extends BaseError {}
class CustomNamespaceError extends BaseError {
  constructor(message: string, cause?: Error) {
    super(message, cause, 'CustomNS')
  }
}

describe('BaseError', () => {
  it('should create error with auto-generated namespace', () => {
    const error = new TestError('Test message')

    expect(error.message).toBe('[Test] Test message')
    expect(error.namespace).toBe('Test')
    expect(error.name).toBe('TestError')
  })

  it('should include cause in error chain', () => {
    const cause = new Error('Root cause')
    const error = new TestError('Wrapper error', cause)

    expect(error.cause).toBe(cause)
    expect(error.message).toBe('[Test] Wrapper error')
  })

  it('should respect custom namespace override', () => {
    const error = new CustomNamespaceError('Custom message')

    expect(error.message).toBe('[CustomNS] Custom message')
    expect(error.namespace).toBe('CustomNS')
  })

  it('should strip "Error" suffix from class name for namespace', () => {
    const error = new TestError('Message')

    expect(error.namespace).toBe('Test')
    expect(error.namespace).not.toBe('TestError')
  })

  it('should be instanceof Error', () => {
    const error = new TestError('Message')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(BaseError)
    expect(error).toBeInstanceOf(TestError)
  })
})
