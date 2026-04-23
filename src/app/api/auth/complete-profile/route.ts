import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth.config"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { status: true } })
  if (dbUser?.status !== "PENDING") {
    await logActivity({ userId: session.user.id, action: "COMPLETE_PROFILE_BLOCKED", resource: "auth" })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.role) {
    return NextResponse.json({ error: "Role is required" }, { status: 400 })
  }

  const { role, profile } = body as {
    role: string
    profile: Record<string, unknown>
  }

  const userId = session.user.id

  switch (role) {
    case "GOVERNMENT":
      await prisma.governmentProfile.upsert({
        where: { userId },
        create: {
          userId,
          ministry: profile.ministry as string | undefined,
          country: profile.country as string | undefined,
          region: profile.region as string | undefined,
          pppUnitName: profile.pppUnitName as string | undefined,
          regulatoryAuth: profile.regulatoryAuth as string | undefined,
        },
        update: {
          ministry: profile.ministry as string | undefined,
          country: profile.country as string | undefined,
          region: profile.region as string | undefined,
          pppUnitName: profile.pppUnitName as string | undefined,
          regulatoryAuth: profile.regulatoryAuth as string | undefined,
        },
      })
      break

    case "SPONSOR_DEVELOPER":
      await prisma.sponsorProfile.upsert({
        where: { userId },
        create: {
          userId,
          companyName: profile.companyName as string | undefined,
          registrationNo: profile.registrationNo as string | undefined,
          yearsExperience: profile.yearsExperience
            ? Number(profile.yearsExperience)
            : undefined,
          portfolioSize: profile.portfolioSize
            ? Number(profile.portfolioSize)
            : undefined,
          sectors: (profile.sectors as string[]) ?? [],
          regions: (profile.regions as string[]) ?? [],
        },
        update: {
          companyName: profile.companyName as string | undefined,
          registrationNo: profile.registrationNo as string | undefined,
          yearsExperience: profile.yearsExperience
            ? Number(profile.yearsExperience)
            : undefined,
          portfolioSize: profile.portfolioSize
            ? Number(profile.portfolioSize)
            : undefined,
          sectors: (profile.sectors as string[]) ?? [],
          regions: (profile.regions as string[]) ?? [],
        },
      })
      break

    case "EPC_OPERATOR":
      await prisma.ePCProfile.upsert({
        where: { userId },
        create: {
          userId,
          companyName: profile.companyName as string | undefined,
          capabilities: (profile.capabilities as string[]) ?? [],
          sectors: (profile.sectors as string[]) ?? [],
          regions: (profile.regions as string[]) ?? [],
          certifications: (profile.certifications as string[]) ?? [],
        },
        update: {
          companyName: profile.companyName as string | undefined,
          capabilities: (profile.capabilities as string[]) ?? [],
          sectors: (profile.sectors as string[]) ?? [],
          regions: (profile.regions as string[]) ?? [],
          certifications: (profile.certifications as string[]) ?? [],
        },
      })
      break

    case "INSTITUTIONAL_INVESTOR":
      await prisma.investorProfile.upsert({
        where: { userId },
        create: {
          userId,
          investorType: profile.investorType as never,
          aum: profile.aum ? Number(profile.aum) : undefined,
          minTicket: profile.minTicket ? Number(profile.minTicket) : undefined,
          maxTicket: profile.maxTicket ? Number(profile.maxTicket) : undefined,
          preferredSectors: (profile.preferredSectors as string[]) ?? [],
          preferredRegions: (profile.preferredRegions as string[]) ?? [],
          targetIRR: profile.targetIRR ? Number(profile.targetIRR) : undefined,
          requiresESG: Boolean(profile.requiresESG),
          accredited: Boolean(profile.accredited),
        },
        update: {
          investorType: profile.investorType as never,
          aum: profile.aum ? Number(profile.aum) : undefined,
          minTicket: profile.minTicket ? Number(profile.minTicket) : undefined,
          maxTicket: profile.maxTicket ? Number(profile.maxTicket) : undefined,
          preferredSectors: (profile.preferredSectors as string[]) ?? [],
          preferredRegions: (profile.preferredRegions as string[]) ?? [],
          targetIRR: profile.targetIRR ? Number(profile.targetIRR) : undefined,
          requiresESG: Boolean(profile.requiresESG),
          accredited: Boolean(profile.accredited),
        },
      })
      break

    default:
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      role: role as never,
      status: "PENDING", // stays pending until admin approves
    },
  })

  await logActivity({
    userId,
    action: "COMPLETE_PROFILE",
    resource: "User",
    resourceId: userId,
    details: { role },
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
  })

  return NextResponse.json({ user: updated })
}
