// src/lib/config-validator.ts
// Validates required environment variables at startup
// Fails fast with clear error messages

interface ConfigRequirement {
  key: string
  required: boolean
  validator?: (value: string) => boolean
  description: string
  example?: string
}

const CONFIG_REQUIREMENTS: ConfigRequirement[] = [
  // Database
  {
    key: 'DATABASE_URL',
    required: true,
    validator: (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
    description: 'PostgreSQL connection string',
    example: 'postgresql://user:pass@host:5432/db',
  },
  // Auth
  {
    key: 'NEXTAUTH_SECRET',
    required: true,
    validator: (v) => v.length >= 32,
    description: 'NextAuth secret (min 32 chars)',
    example: 'run: openssl rand -base64 32',
  },
  {
    key: 'NEXTAUTH_URL',
    required: true,
    validator: (v) => v.startsWith('http://') || v.startsWith('https://'),
    description: 'Application URL',
    example: 'https://app.africa-infra.com',
  },
  // Azure AD (required in production)
  {
    key: 'AZURE_AD_CLIENT_ID',
    required: process.env.NODE_ENV === 'production',
    description: 'Azure AD application client ID',
  },
  {
    key: 'AZURE_AD_CLIENT_SECRET',
    required: process.env.NODE_ENV === 'production',
    description: 'Azure AD application client secret',
  },
  {
    key: 'AZURE_AD_TENANT_ID',
    required: process.env.NODE_ENV === 'production',
    description: 'Azure AD tenant ID',
  },
  // AI Services
  {
    key: 'ANTHROPIC_API_KEY',
    required: process.env.NODE_ENV === 'production',
    validator: (v) => v.startsWith('sk-ant-'),
    description: 'Anthropic API key for AI features',
    example: 'sk-ant-...',
  },
  // Redis (optional but recommended)
  {
    key: 'UPSTASH_REDIS_REST_URL',
    required: false,
    validator: (v) => v.startsWith('http://') || v.startsWith('https://'),
    description: 'Upstash Redis REST URL for caching',
  },
]

export interface ConfigValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateConfig(): ConfigValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const requirement of CONFIG_REQUIREMENTS) {
    const value = process.env[requirement.key]

    if (!value || value.trim() === '') {
      if (requirement.required) {
        errors.push(
          `❌ MISSING REQUIRED: ${requirement.key}\n` +
            `   Description: ${requirement.description}` +
            (requirement.example ? `\n   Example: ${requirement.example}` : '')
        )
      } else {
        warnings.push(`⚠️  Optional missing: ${requirement.key} - ${requirement.description}`)
      }
      continue
    }

    if (requirement.validator && !requirement.validator(value)) {
      if (requirement.required) {
        errors.push(
          `❌ INVALID VALUE: ${requirement.key}\n` +
            `   Description: ${requirement.description}` +
            (requirement.example ? `\n   Example: ${requirement.example}` : '')
        )
      } else {
        warnings.push(`⚠️  Invalid optional: ${requirement.key} - ${requirement.description}`)
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function assertValidConfig(): void {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') return

  const result = validateConfig()

  if (result.warnings.length > 0) {
    console.warn('\n🔧 AIP Platform Config Warnings:')
    result.warnings.forEach((w) => console.warn(w))
  }

  if (!result.valid) {
    console.error('\n💥 AIP Platform STARTUP FAILED - Missing Configuration:\n')
    result.errors.forEach((e) => console.error(e))
    console.error('\n📖 See .env.example for all required variables\n')
    process.exit(1)
  }

  console.log('✅ AIP Platform config validated successfully')
}
