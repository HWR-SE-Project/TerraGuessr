-- Per-account sign-in throttling (failed attempts within a window, temporary lock).
ALTER TABLE "User"
    ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3),
    ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- Idle-session tracking so abandoned sessions can be expired and cleaned up.
ALTER TABLE "AuthSession" ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Cleanup jobs scan by expiry/idle age rather than by user.
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE INDEX "AuthSession_lastUsedAt_idx" ON "AuthSession"("lastUsedAt");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");
CREATE INDEX "EmailChangeRequest_expiresAt_idx" ON "EmailChangeRequest"("expiresAt");
