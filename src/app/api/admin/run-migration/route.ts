import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Emergency migration endpoint to add missing sessionVersion column
 * This is a one-time fix for production database schema mismatch
 */
export async function POST(req: Request) {
  try {
    // Run the migration SQL directly
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;
    `)

    // Create index for performance
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "User_sessionVersion_idx"
      ON "User"("sessionVersion");
    `)

    // Verify column exists
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'User'
      AND column_name = 'sessionVersion';
    `)

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
      columnAdded: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Migration failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check if migration is needed
export async function GET() {
  try {
    const result = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'User'
      AND column_name = 'sessionVersion';
    `)

    const columnExists = result.length > 0

    return NextResponse.json({
      migrationNeeded: !columnExists,
      columnExists,
      message: columnExists
        ? "sessionVersion column exists - no migration needed"
        : "sessionVersion column missing - migration required",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
