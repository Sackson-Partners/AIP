import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const confirmDelete = process.argv.includes('--confirm-delete')

  console.log('🔍 Scanning for orphaned Azure AD users (no linked Account)...\n')

  const orphaned = await prisma.user.findMany({
    where: {
      authProvider: 'AZURE_AD',
      accounts: { none: {} },
    },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      createdAt: true,
    },
  })

  if (orphaned.length === 0) {
    console.log('✅ No orphaned Azure AD users found.')
    return
  }

  console.log(`Found ${orphaned.length} orphaned Azure AD user(s):\n`)
  orphaned.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email} (id: ${u.id}, status: ${u.status}, created: ${u.createdAt.toISOString()})`)
  })

  if (!confirmDelete) {
    console.log('\n⚠️  DRY RUN — no changes made.')
    console.log('   Run with --confirm-delete to permanently delete these users.')
    return
  }

  console.log('\n🗑️  Deleting orphaned users...')
  const result = await prisma.user.deleteMany({
    where: {
      id: { in: orphaned.map((u) => u.id) },
    },
  })
  console.log(`✅ Deleted ${result.count} orphaned Azure AD user(s).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
