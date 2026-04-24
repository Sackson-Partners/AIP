/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import bcrypt from "bcryptjs"
import { config } from 'dotenv'

config({ path: '.env.local', override: true })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  console.log("🌱 Seeding AIP Database...")

  // ── Super Admin ──────────────────────────────────────────────────────────────
  const superAdminHash = await bcrypt.hash("AIP@SuperAdmin2024!", 14)
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@aip.com" },
    update: {},
    create: {
      email: "superadmin@aip.com",
      name: "Super Administrator",
      firstName: "Super",
      lastName: "Administrator",
      passwordHash: superAdminHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      authProvider: "INTERNAL",
      mustChangePass: true,
      emailVerified: new Date(),
      internalProfile: {
        create: {
          employeeId: "AIP-INT-001",
          department: "Platform Administration",
          accessLevel: 10,
          canApprove: true,
          canPublish: true,
          canManageUsers: true,
        },
      },
    },
  })
  console.log("✅ Super Admin: superadmin@aip.com")

  // ── Lead Analyst ─────────────────────────────────────────────────────────────
  const analystHash = await bcrypt.hash("AIP@Analyst2024!", 14)
  await prisma.user.upsert({
    where: { email: "analyst@aip.com" },
    update: {},
    create: {
      email: "analyst@aip.com",
      name: "Lead Analyst",
      firstName: "Lead",
      lastName: "Analyst",
      passwordHash: analystHash,
      role: "ANALYST",
      status: "ACTIVE",
      authProvider: "INTERNAL",
      mustChangePass: true,
      emailVerified: new Date(),
      internalProfile: {
        create: {
          employeeId: "AIP-INT-002",
          department: "Deal Analysis",
          accessLevel: 7,
          canApprove: true,
          canPublish: true,
          canManageUsers: false,
        },
      },
    },
  })
  console.log("✅ Lead Analyst: analyst@aip.com")

  // ── Junior Analyst ────────────────────────────────────────────────────────────
  const jrHash = await bcrypt.hash("AIP@JrAnalyst2024!", 14)
  await prisma.user.upsert({
    where: { email: "jranalyst@aip.com" },
    update: {},
    create: {
      email: "jranalyst@aip.com",
      name: "Junior Analyst",
      firstName: "Junior",
      lastName: "Analyst",
      passwordHash: jrHash,
      role: "ANALYST",
      status: "ACTIVE",
      authProvider: "INTERNAL",
      mustChangePass: true,
      emailVerified: new Date(),
      internalProfile: {
        create: {
          employeeId: "AIP-INT-003",
          department: "Research",
          accessLevel: 3,
          canApprove: false,
          canPublish: false,
          canManageUsers: false,
        },
      },
    },
  })
  console.log("✅ Junior Analyst: jranalyst@aip.com")

  // ── System Settings ──────────────────────────────────────────────────────────
  const settings: { key: string; value: string; description: string }[] = [
    { key: "platform_name",           value: "AIP - Africa Infrastructure Pipeline", description: "Platform display name" },
    { key: "require_kyc",             value: "true",  description: "Require KYC for investors" },
    { key: "auto_approve_azure_users",value: "false", description: "Auto-activate new Microsoft sign-in users" },
    { key: "petfel_min_score",        value: "60",    description: "Minimum PETFEL score for project publication" },
    { key: "ein_expiry_days",         value: "180",   description: "EIN report validity in days" },
    { key: "max_upload_size_mb",      value: "50",    description: "Maximum document upload size in MB" },
    { key: "maintenance_mode",        value: "false", description: "Show maintenance page to all users" },
    { key: "support_email",           value: "support@aip.com", description: "Platform support email" },
  ]

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value, description: s.description, updatedBy: superAdmin.id },
    })
  }
  console.log(`✅ System settings: ${settings.length} records`)

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("⚠️  SECURITY: Change these credentials NOW!")
  console.log("  superadmin@aip.com → AIP@SuperAdmin2024!")
  console.log("  analyst@aip.com → AIP@Analyst2024!")
  console.log("  jranalyst@aip.com → AIP@JrAnalyst2024!")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
