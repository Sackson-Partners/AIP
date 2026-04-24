import { defineConfig, env } from 'prisma/config'
import fs from 'node:fs'
import path from 'node:path'

// Manually parse and inject .env.local before Prisma reads process.env
// (Prisma CLI only auto-loads .env, not .env.local)
function injectEnvFile(filePath: string): void {
  try {
    const abs = path.resolve(process.cwd(), filePath)
    const lines = fs.readFileSync(abs, 'utf8').split('\n')
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq < 1) continue
      const key = t.substring(0, eq).trim()
      let val = t.substring(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      // Only set if not already defined (so shell env wins)
      if (process.env[key] === undefined) process.env[key] = val
    }
  } catch { /* file absent — skip */ }
}

injectEnvFile('.env')
injectEnvFile('.env.local')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
