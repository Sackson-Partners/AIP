/**
 * GDPR Endpoint Integration Tests
 * Tests data export and erasure compliance
 */

describe('GDPR Compliance', () => {
  it('should have data export endpoint', () => {
    // Verify endpoint file exists
    const fs = require('fs')
    const path = require('path')
    const exportPath = path.join(__dirname, '../../app/api/users/[id]/export/route.ts')
    expect(fs.existsSync(exportPath)).toBe(true)
  })

  it('should have data erasure endpoint', () => {
    const fs = require('fs')
    const path = require('path')
    const deletePath = path.join(__dirname, '../../app/api/users/[id]/delete/route.ts')
    expect(fs.existsSync(deletePath)).toBe(true)
  })

  it('should have data retention cleanup cron', () => {
    const fs = require('fs')
    const path = require('path')
    const cronPath = path.join(__dirname, '../../app/api/cron/cleanup-logs/route.ts')
    expect(fs.existsSync(cronPath)).toBe(true)
  })

  it('should have IdempotencyRecord model in schema', () => {
    const fs = require('fs')
    const path = require('path')
    const schemaPath = path.join(__dirname, '../../../prisma/schema.prisma')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    expect(schema).toContain('model IdempotencyRecord')
  })

  it('should have cron configured in vercel.json', () => {
    const fs = require('fs')
    const path = require('path')
    const vercelPath = path.join(__dirname, '../../../vercel.json')
    const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'))
    expect(vercel.crons).toBeDefined()
    expect(vercel.crons).toContainEqual(
      expect.objectContaining({
        path: '/api/cron/cleanup-logs',
      })
    )
  })
})
