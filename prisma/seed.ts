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

  // Seed default project templates
  const templates = [
    {
      id: 'tpl-solar',
      name: 'Solar Power Plant',
      description: 'Utility-scale solar photovoltaic power generation project',
      sector: 'ENERGY',
      stage: 'FEASIBILITY',
      defaultFields: {
        sector: 'ENERGY',
        projectType: 'BOT',
        dealStage: 'FEASIBILITY',
        riskRating: 'Medium',
      },
      isPublic: true,
      createdById: user.id,
    },
    {
      id: 'tpl-wind',
      name: 'Wind Farm',
      description: 'Onshore or offshore wind energy generation facility',
      sector: 'ENERGY',
      stage: 'FEASIBILITY',
      defaultFields: {
        sector: 'ENERGY',
        projectType: 'BOT',
        dealStage: 'FEASIBILITY',
        riskRating: 'Medium-High',
      },
      isPublic: true,
      createdById: user.id,
    },
    {
      id: 'tpl-road',
      name: 'Road Infrastructure',
      description: 'Highway, expressway, or rural road construction/rehabilitation',
      sector: 'TRANSPORT',
      stage: 'PREFEASIBILITY',
      defaultFields: {
        sector: 'TRANSPORT',
        projectType: 'PPP',
        dealStage: 'PREFEASIBILITY',
        riskRating: 'Medium',
      },
      isPublic: true,
      createdById: user.id,
    },
    {
      id: 'tpl-water',
      name: 'Water Treatment Plant',
      description: 'Municipal water supply and wastewater treatment facility',
      sector: 'WATER',
      stage: 'FEASIBILITY',
      defaultFields: {
        sector: 'WATER',
        projectType: 'CONCESSION',
        dealStage: 'FEASIBILITY',
        riskRating: 'Medium',
      },
      isPublic: true,
      createdById: user.id,
    },
    {
      id: 'tpl-housing',
      name: 'Affordable Housing',
      description: 'Mass housing development for low-to-middle income populations',
      sector: 'HOUSING',
      stage: 'CONCEPT',
      defaultFields: {
        sector: 'HOUSING',
        projectType: 'OTHER',
        dealStage: 'CONCEPT',
        riskRating: 'Variable',
      },
      isPublic: true,
      createdById: user.id,
    },
  ]

  for (const tpl of templates) {
    await prisma.projectTemplate.upsert({
      where: { id: tpl.id },
      update: {},
      create: tpl,
    })
  }

  console.log(`✅ Seeded ${templates.length} default project templates`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
