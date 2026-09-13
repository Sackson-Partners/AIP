/**
 * Logger Tests
 *
 * Tests for PII sanitization, structured logging, and context management.
 */

import { logger } from '../logger'

describe('Logger PII Sanitization', () => {
  let consoleOutput: string[] = []

  beforeEach(() => {
    consoleOutput = []
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation((...args) => {
      consoleOutput.push(JSON.stringify(args))
    })
    jest.spyOn(console, 'warn').mockImplementation((...args) => {
      consoleOutput.push(JSON.stringify(args))
    })
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      consoleOutput.push(JSON.stringify(args))
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('PII field masking', () => {
    it('should fully mask password fields', () => {
      logger.info('User login', {
        email: 'user@example.com',
        password: 'secret123',
      })

      const output = consoleOutput.join(' ')
      expect(output).not.toContain('secret123')
      expect(output).toContain('[REDACTED]')
    })

    it('should fully mask token fields', () => {
      logger.info('API request', {
        accessToken: 'abc123xyz',
        refreshToken: 'refresh456',
        apiKey: 'key789',
      })

      const output = consoleOutput.join(' ')
      expect(output).not.toContain('abc123xyz')
      expect(output).not.toContain('refresh456')
      expect(output).not.toContain('key789')
      expect(output).toContain('[REDACTED]')
    })

    it('should partially mask email addresses', () => {
      logger.info('User created', {
        email: 'john.doe@example.com',
      })

      const output = consoleOutput.join(' ')
      expect(output).not.toContain('john.doe@example.com')
      expect(output).toMatch(/j\*\*\*@example\.com/)
    })

    it('should partially mask phone numbers', () => {
      logger.info('Contact info', {
        phone: '+1-555-123-4567',
      })

      const output = consoleOutput.join(' ')
      expect(output).not.toContain('+1-555-123-4567')
      expect(output).toMatch(/\*\*\*4567/)
    })
  })

  describe('Nested object sanitization', () => {
    it('should sanitize nested PII fields', () => {
      logger.info('User data', {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'secret',
        },
      })

      const output = consoleOutput.join(' ')
      expect(output).toContain('John Doe')
      expect(output).not.toContain('secret')
      expect(output).not.toContain('john@example.com')
    })

    it('should sanitize arrays with PII', () => {
      logger.info('Multiple users', {
        users: [
          { email: 'user1@example.com', password: 'pass1' },
          { email: 'user2@example.com', password: 'pass2' },
        ],
      })

      const output = consoleOutput.join(' ')
      expect(output).not.toContain('pass1')
      expect(output).not.toContain('pass2')
      expect(output).not.toContain('user1@example.com')
    })
  })

  describe('Context persistence', () => {
    it('should persist context across log calls', () => {
      const contextLogger = logger.withContext({
        requestId: 'req-123',
        userId: 'user-456',
      })

      contextLogger.info('Action 1')
      contextLogger.info('Action 2')

      const output = consoleOutput.join(' ')
      expect(output).toContain('req-123')
      expect(output).toContain('user-456')
    })

    it('should merge persistent context with call-time context', () => {
      const contextLogger = logger.withContext({
        requestId: 'req-123',
      })

      contextLogger.info('Action', {
        actionType: 'create',
      })

      const output = consoleOutput.join(' ')
      expect(output).toContain('req-123')
      expect(output).toContain('create')
    })
  })

  describe('Log levels', () => {
    it('should log info messages', () => {
      logger.info('Info message', { detail: 'test' })
      expect(console.log).toHaveBeenCalled()
    })

    it('should log warning messages', () => {
      logger.warn('Warning message', { detail: 'test' })
      expect(console.log).toHaveBeenCalled()
    })

    it('should log error messages with error objects', () => {
      const error = new Error('Test error')
      logger.error('Error occurred', error, { detail: 'test' })
      expect(console.log).toHaveBeenCalled()

      const output = consoleOutput.join(' ')
      expect(output).toContain('Error occurred')
    })
  })

  describe('Production environment', () => {
    it('should include environment info', () => {
      logger.info('Test message')

      const output = consoleOutput.join(' ')
      expect(output).toContain('timestamp')
      expect(output).toContain('level')
      expect(output).toContain('message')
    })
  })

  describe('Edge cases', () => {
    it('should handle null and undefined context', () => {
      logger.info('Message', undefined)
      logger.info('Message', null as any)
      expect(console.log).toHaveBeenCalled()
    })

    it('should handle non-object context', () => {
      logger.info('Message', 'string context' as any)
      expect(console.log).toHaveBeenCalled()
    })
  })
})

describe('Logger format', () => {
  it('should output JSON format', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    logger.info('Test message', { key: 'value' })

    const output = consoleSpy.mock.calls[0][0]
    expect(() => JSON.parse(output)).not.toThrow()

    consoleSpy.mockRestore()
  })

  it('should include timestamp', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    logger.info('Test message')

    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output).toHaveProperty('timestamp')
    expect(new Date(output.timestamp).getTime()).toBeGreaterThan(0)

    consoleSpy.mockRestore()
  })

  it('should include level', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    logger.info('Test message')

    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.level).toBe('INFO')

    consoleSpy.mockRestore()
  })
})
