-- CreateTable
CREATE TABLE "DataRoomAccess" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ndaSigned" BOOLEAN NOT NULL DEFAULT false,
    "ndaSignedAt" TIMESTAMP(3),
    "accessCode" TEXT,
    "codeIssuedAt" TIMESTAMP(3),
    "accessLevel" TEXT NOT NULL DEFAULT 'VIEW',
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DataRoomAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataRoomAccess_projectId_idx" ON "DataRoomAccess"("projectId");

-- CreateIndex
CREATE INDEX "DataRoomAccess_userId_idx" ON "DataRoomAccess"("userId");

-- CreateIndex
CREATE INDEX "DataRoomAccess_accessCode_idx" ON "DataRoomAccess"("accessCode");

-- CreateIndex
CREATE UNIQUE INDEX "DataRoomAccess_projectId_userId_key" ON "DataRoomAccess"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "DataRoomAccess" ADD CONSTRAINT "DataRoomAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRoomAccess" ADD CONSTRAINT "DataRoomAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
