/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const email    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@aip.internal'
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!password) {
    throw new Error('SEED_ADMIN_PASSWORD environment variable is required')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Remove any stale InternalProfile using the reserved employeeId
  // (can happen if a previous seed run used a different admin email)
  await prisma.internalProfile.deleteMany({ where: { employeeId: 'AIP-INT-001' } })

  const profileData = {
    employeeId:     'AIP-INT-001',
    department:     'Platform Administration',
    accessLevel:    10,
    canApprove:     true,
    canPublish:     true,
    canManageUsers: true,
  }

  const user = await prisma.user.upsert({
    where:  { email },
    update: {
      passwordHash,
      role: 'SUPER_ADMIN',
      internalProfile: {
        upsert: { create: profileData, update: {} },
      },
    },
    create: {
      email,
      name:          'Super Administrator',
      firstName:     'Super',
      lastName:      'Administrator',
      passwordHash,
      role:          'SUPER_ADMIN',
      status:        'ACTIVE',
      authProvider:  'INTERNAL',
      mustChangePass: true,
      emailVerified: new Date(),
      internalProfile: {
        create: profileData,
      },
    },
  })

  console.log(`✅ Super Admin seeded: ${user.email} (id: ${user.id})`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
