/**
 * Standardized API Response Format
 *
 * Provides consistent response structure across all API endpoints
 * with success/error handling, pagination, and metadata support.
 */

import { NextResponse } from 'next/server'

/**
 * Standard success response structure
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  message?: string
  meta?: {
    timestamp?: string
    requestId?: string
    [key: string]: unknown
  }
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext?: boolean
    hasPrev?: boolean
  }
  warning?: string
  [key: string]: unknown // Allow additional fields for backward compatibility
}

/**
 * Standard error response structure
 */
export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
    field?: string
    stack?: string // Only in development
  }
  meta?: {
    timestamp?: string
    requestId?: string
    [key: string]: unknown
  }
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number
  limit: number
  total: number
  pages?: number
  hasNext?: boolean
  hasPrev?: boolean
}

/**
 * Create a standardized success response
 *
 * @param data Response data
 * @param options Optional message, metadata, pagination
 * @param status HTTP status code (default: 200)
 * @returns NextResponse with standardized format
 */
export function apiSuccess<T>(
  data: T,
  options?: {
    message?: string
    meta?: Record<string, unknown>
    pagination?: PaginationParams
    warning?: string
    status?: number
  }
): NextResponse<ApiSuccessResponse<T>> {
  const status = options?.status ?? 200

  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(options?.message && { message: options.message }),
    ...(options?.meta && {
      meta: {
        timestamp: new Date().toISOString(),
        ...options.meta,
      },
    }),
    ...(options?.pagination && {
      pagination: {
        ...options.pagination,
        pages: options.pagination.pages ?? Math.ceil(options.pagination.total / options.pagination.limit),
        hasNext: options.pagination.hasNext ?? options.pagination.page < Math.ceil(options.pagination.total / options.pagination.limit),
        hasPrev: options.pagination.hasPrev ?? options.pagination.page > 1,
      },
    }),
    ...(options?.warning && { warning: options.warning }),
  }

  return NextResponse.json(response, { status })
}

/**
 * Create a standardized error response
 *
 * @param error Error message or Error object
 * @param options Error code, details, field, status
 * @returns NextResponse with standardized error format
 */
export function apiError(
  error: string | Error,
  options?: {
    code?: string
    details?: unknown
    field?: string
    status?: number
    meta?: Record<string, unknown>
  }
): NextResponse<ApiErrorResponse> {
  const status = options?.status ?? 500
  const message = typeof error === 'string' ? error : error.message
  const code = options?.code ?? inferErrorCode(status)

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(options?.details && { details: options.details }),
      ...(options?.field && { field: options.field }),
      ...(process.env.NODE_ENV === 'development' && error instanceof Error && {
        stack: error.stack,
      }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...options?.meta,
    },
  }

  return NextResponse.json(response, { status })
}

/**
 * Create a validation error response (422)
 *
 * @param message Validation error message
 * @param details Validation error details (e.g., Zod error flatten)
 * @param field Optional field name that failed validation
 * @returns NextResponse with validation error format
 */
export function apiValidationError(
  message: string,
  details?: unknown,
  field?: string
): NextResponse<ApiErrorResponse> {
  return apiError(message, {
    code: 'VALIDATION_ERROR',
    status: 422,
    details,
    field,
  })
}

/**
 * Create an unauthorized error response (401)
 *
 * @param message Optional custom message
 * @returns NextResponse with unauthorized error format
 */
export function apiUnauthorized(
  message = 'Unauthorized - authentication required'
): NextResponse<ApiErrorResponse> {
  return apiError(message, {
    code: 'UNAUTHORIZED',
    status: 401,
  })
}

/**
 * Create a forbidden error response (403)
 *
 * @param message Optional custom message
 * @returns NextResponse with forbidden error format
 */
export function apiForbidden(
  message = 'Forbidden - insufficient permissions'
): NextResponse<ApiErrorResponse> {
  return apiError(message, {
    code: 'FORBIDDEN',
    status: 403,
  })
}

/**
 * Create a not found error response (404)
 *
 * @param resource Optional resource name
 * @returns NextResponse with not found error format
 */
export function apiNotFound(
  resource = 'Resource'
): NextResponse<ApiErrorResponse> {
  return apiError(`${resource} not found`, {
    code: 'NOT_FOUND',
    status: 404,
  })
}

/**
 * Create a conflict error response (409)
 *
 * @param message Conflict message
 * @returns NextResponse with conflict error format
 */
export function apiConflict(
  message: string
): NextResponse<ApiErrorResponse> {
  return apiError(message, {
    code: 'CONFLICT',
    status: 409,
  })
}

/**
 * Create a rate limit error response (429)
 *
 * @param retryAfter Optional retry-after seconds
 * @returns NextResponse with rate limit error format
 */
export function apiRateLimited(
  retryAfter?: number
): NextResponse<ApiErrorResponse> {
  const response = apiError('Rate limit exceeded', {
    code: 'RATE_LIMITED',
    status: 429,
    ...(retryAfter && {
      meta: { retryAfter },
    }),
  })

  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString())
  }

  return response
}

/**
 * Create a no content response (204)
 *
 * @returns NextResponse with no content
 */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * Create a created response (201)
 *
 * @param data Created resource
 * @param options Optional message and metadata
 * @returns NextResponse with created resource
 */
export function apiCreated<T>(
  data: T,
  options?: {
    message?: string
    meta?: Record<string, unknown>
    warning?: string
  }
): NextResponse<ApiSuccessResponse<T>> {
  return apiSuccess(data, {
    status: 201,
    message: options?.message ?? 'Resource created successfully',
    meta: options?.meta,
    warning: options?.warning,
  })
}

/**
 * Create a paginated list response
 *
 * @param data Array of items
 * @param pagination Pagination parameters
 * @param options Optional message and metadata
 * @returns NextResponse with paginated data
 */
export function apiList<T>(
  data: T[],
  pagination: PaginationParams,
  options?: {
    message?: string
    meta?: Record<string, unknown>
  }
): NextResponse<ApiSuccessResponse<T[]>> {
  return apiSuccess(data, {
    pagination,
    message: options?.message,
    meta: options?.meta,
  })
}

/**
 * Infer error code from HTTP status
 */
function inferErrorCode(status: number): string {
  const codes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
  }

  return codes[status] ?? 'UNKNOWN_ERROR'
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(
  response: ApiSuccessResponse | ApiErrorResponse
): response is ApiErrorResponse {
  return response.success === false
}

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(
  response: ApiSuccessResponse<T> | ApiErrorResponse
): response is ApiSuccessResponse<T> {
  return response.success === true
}
