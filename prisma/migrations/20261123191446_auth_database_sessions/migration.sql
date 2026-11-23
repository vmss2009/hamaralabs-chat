/*
  Database-backed sessions for Auth.js (NextAuth) via @auth/prisma-adapter.

  - User gains the fields the adapter manages (name, emailVerified, image).
  - Account links a user to their Authentik login; Session holds one row per
    signed-in browser (signing out deletes it).

  Backfill for existing users: before this migration the app used JWT sessions
  and stored each user under id = their Authentik subject ("sub"). Each existing
  user gets an Account row (provider "authentik", providerAccountId = that id) so
  their next sign-in resolves to the same user, keeping their rooms and messages.
  Names are copied from user_meta_data, where the old login flow kept them.
*/

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "image" TEXT,
ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: link existing users to their Authentik login
INSERT INTO "Account" ("id", "userId", "type", "provider", "providerAccountId", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'oidc', 'authentik', "id", CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("provider", "providerAccountId") DO NOTHING;

-- Backfill: names previously kept in user_meta_data
UPDATE "User"
SET "name" = "user_meta_data"->>'name'
WHERE "name" IS NULL AND jsonb_typeof("user_meta_data"->'name') = 'string';
