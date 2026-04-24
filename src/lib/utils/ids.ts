import { prisma } from "@/lib/prisma"

/** Generate a project code: AIP-YYYY-XXXX (sequential within the year). */
export async function generateProjectCode(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `AIP-${year}-`
  const count = await prisma.project.count({
    where: { code: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(4, "0")}`
}

/** Generate an EIN number: AIP-EIN-YYYY-XXXX (sequential within the year). */
export async function generateEINNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `AIP-EIN-${year}-`
  const count = await prisma.eINReport.count({
    where: { einNumber: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(4, "0")}`
}

/** Generate an employee ID: AIP-INT-XXX (sequential across all internal profiles). */
export async function generateEmployeeId(): Promise<string> {
  const count = await prisma.internalProfile.count()
  return `AIP-INT-${String(count + 1).padStart(3, "0")}`
}
