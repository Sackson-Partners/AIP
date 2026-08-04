/**
 * Input Sanitization Utilities
 *
 * Provides sanitization functions to prevent XSS and injection attacks.
 * Use these helpers for all user-supplied text that will be:
 * - Stored in database
 * - Rendered as HTML
 * - Used in PDF generation
 * - Sent in emails
 */

/**
 * Sanitize HTML to prevent XSS attacks
 * Strips all HTML tags and dangerous characters
 *
 * @param input - User-supplied text
 * @returns Sanitized plain text
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitize text for safe display
 * Removes control characters and normalizes whitespace
 *
 * @param input - User-supplied text
 * @returns Sanitized text
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''

  return input
    // Remove control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .trim()
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
}

/**
 * Sanitize filename for safe storage
 * Removes path traversal and special characters
 *
 * @param filename - User-supplied filename
 * @returns Safe filename
 */
export function sanitizeFilename(filename: string | null | undefined): string {
  if (!filename) return 'untitled'

  return filename
    // Remove path traversal
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '')
    // Remove special characters except dots, dashes, underscores
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    // Limit length
    .slice(0, 255)
}

/**
 * Sanitize email for validation
 * Basic email format check
 *
 * @param email - User-supplied email
 * @returns Sanitized email or null if invalid
 */
export function sanitizeEmail(email: string | null | undefined): string | null {
  if (!email) return null

  const trimmed = email.trim().toLowerCase()

  // Basic email regex (not comprehensive, but catches common issues)
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

  return emailRegex.test(trimmed) ? trimmed : null
}

/**
 * Sanitize URL for safe use
 * Ensures URL uses allowed protocols
 *
 * @param url - User-supplied URL
 * @param allowedProtocols - Allowed URL protocols (default: http, https)
 * @returns Sanitized URL or null if invalid
 */
export function sanitizeUrl(
  url: string | null | undefined,
  allowedProtocols: string[] = ['http:', 'https:']
): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url.trim())

    if (!allowedProtocols.includes(parsed.protocol)) {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Sanitize SQL-like input for safe use in search queries
 * Escapes SQL wildcards and special characters
 *
 * @param input - User-supplied search term
 * @returns Escaped search term
 */
export function sanitizeSqlLike(input: string | null | undefined): string {
  if (!input) return ''

  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
}

/**
 * Sanitize JSON for safe storage
 * Ensures valid JSON and removes dangerous content
 *
 * @param input - User-supplied JSON string
 * @returns Sanitized JSON string or null if invalid
 */
export function sanitizeJson(input: string | null | undefined): string | null {
  if (!input) return null

  try {
    // Parse and re-stringify to ensure valid JSON
    const parsed = JSON.parse(input)
    return JSON.stringify(parsed)
  } catch {
    return null
  }
}

/**
 * Validate and sanitize phone number
 * Basic international phone number format
 *
 * @param phone - User-supplied phone number
 * @returns Sanitized phone number or null if invalid
 */
export function sanitizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null

  // Remove all non-digit characters except + (for country code)
  const cleaned = phone.replace(/[^\d+]/g, '')

  // Must start with + or digit, and be 7-15 digits long
  const phoneRegex = /^[\+]?[\d]{7,15}$/

  return phoneRegex.test(cleaned) ? cleaned : null
}

/**
 * Sanitize numeric input
 * Ensures value is a valid number within range
 *
 * @param input - User-supplied number
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Sanitized number or null if invalid
 */
export function sanitizeNumber(
  input: string | number | null | undefined,
  min?: number,
  max?: number
): number | null {
  if (input === null || input === undefined || input === '') return null

  const num = typeof input === 'string' ? parseFloat(input) : input

  if (isNaN(num) || !isFinite(num)) return null

  if (min !== undefined && num < min) return null
  if (max !== undefined && num > max) return null

  return num
}

/**
 * Sanitize boolean input
 * Converts various truthy/falsy values to boolean
 *
 * @param input - User-supplied boolean value
 * @returns Boolean value
 */
export function sanitizeBoolean(input: unknown): boolean {
  if (typeof input === 'boolean') return input
  if (typeof input === 'string') {
    const lower = input.toLowerCase().trim()
    return lower === 'true' || lower === '1' || lower === 'yes'
  }
  if (typeof input === 'number') return input !== 0
  return false
}
