-- Address changes need proof from both the current and the proposed inbox.
CREATE TABLE "EmailChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oldEmail" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "oldTokenHash" TEXT NOT NULL,
    "newTokenHash" TEXT NOT NULL,
    "oldConfirmedAt" TIMESTAMP(3),
    "newConfirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailChangeRequest_oldTokenHash_key" ON "EmailChangeRequest"("oldTokenHash");
CREATE UNIQUE INDEX "EmailChangeRequest_newTokenHash_key" ON "EmailChangeRequest"("newTokenHash");
CREATE INDEX "EmailChangeRequest_userId_expiresAt_idx" ON "EmailChangeRequest"("userId", "expiresAt");

ALTER TABLE "EmailChangeRequest" ADD CONSTRAINT "EmailChangeRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
