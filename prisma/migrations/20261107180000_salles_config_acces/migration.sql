-- CreateEnum
CREATE TYPE "RoomVisibility" AS ENUM ('PUBLIQUE', 'SUR_CODE', 'PRIVEE');

-- CreateEnum
CREATE TYPE "TextType" AS ENUM ('COHERENT', 'ALEATOIRE');

-- CreateEnum
CREATE TYPE "TextComplexity" AS ENUM ('FACILE', 'MOYEN', 'DIFFICILE');

-- CreateEnum
CREATE TYPE "ErrorMode" AS ENUM ('CORRECTION', 'LIBRE');

-- CreateEnum
CREATE TYPE "BotLevel" AS ENUM ('NOOB', 'BEGINNER', 'INTERMEDIATE', 'EXPERT', 'IMPOSSIBLE');

-- AlterEnum
-- TERMINEE disparaît : une salle terminée revient en attente.
UPDATE "Room" SET "status" = 'EN_ATTENTE' WHERE "status" = 'TERMINEE';
BEGIN;
CREATE TYPE "RoomStatus_new" AS ENUM ('EN_ATTENTE', 'DECOMPTE', 'EN_COURSE', 'RESULTATS', 'FERMEE');
ALTER TABLE "Room" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Room" ALTER COLUMN "status" TYPE "RoomStatus_new" USING ("status"::text::"RoomStatus_new");
ALTER TYPE "RoomStatus" RENAME TO "RoomStatus_old";
ALTER TYPE "RoomStatus_new" RENAME TO "RoomStatus";
DROP TYPE "RoomStatus_old";
ALTER TABLE "Room" ALTER COLUMN "status" SET DEFAULT 'EN_ATTENTE';
COMMIT;

-- DropIndex
DROP INDEX "RoomParticipant_roomId_key_key";

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "accents" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bonusesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "capitals" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "complexity" "TextComplexity" NOT NULL DEFAULT 'MOYEN',
ADD COLUMN     "errorMode" "ErrorMode" NOT NULL DEFAULT 'CORRECTION',
ADD COLUMN     "excludeChars" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "includeChars" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "numbers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "punctuation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "textLanguage" "TextLanguage" NOT NULL DEFAULT 'FR',
ADD COLUMN     "textType" "TextType" NOT NULL DEFAULT 'COHERENT',
ADD COLUMN     "timeLimitSec" INTEGER,
ADD COLUMN     "visibility" "RoomVisibility" NOT NULL DEFAULT 'PUBLIQUE',
ADD COLUMN     "wordCount" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "RoomBot" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "level" "BotLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomInvite" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usedByKey" TEXT,
    "usedByName" TEXT,
    "usedIp" TEXT,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomBan" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomBot_roomId_createdAt_idx" ON "RoomBot"("roomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomInvite_tokenHash_key" ON "RoomInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "RoomInvite_roomId_createdAt_idx" ON "RoomInvite"("roomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomBan_roomId_key_key" ON "RoomBan"("roomId", "key");

-- CreateIndex
CREATE INDEX "Room_visibility_status_idx" ON "Room"("visibility", "status");

-- Une seule salle par personne (SALLE-06) : on garde la présence la plus récente.
DELETE FROM "RoomParticipant" a USING "RoomParticipant" b
WHERE a."key" = b."key" AND (a."joinedAt" < b."joinedAt" OR (a."joinedAt" = b."joinedAt" AND a."id" < b."id"));

-- CreateIndex
CREATE UNIQUE INDEX "RoomParticipant_key_key" ON "RoomParticipant"("key");

-- AddForeignKey
ALTER TABLE "RoomBot" ADD CONSTRAINT "RoomBot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInvite" ADD CONSTRAINT "RoomInvite_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBan" ADD CONSTRAINT "RoomBan_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

