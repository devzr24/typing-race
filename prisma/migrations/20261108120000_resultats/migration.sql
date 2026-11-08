-- CreateEnum
CREATE TYPE "RaceResultKind" AS ENUM ('UTILISATEUR', 'INVITE', 'BOT');

-- CreateEnum
CREATE TYPE "RaceOutcome" AS ENUM ('TERMINE', 'TEMPS_ECOULE', 'ABANDON');

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceResult" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "image" TEXT,
    "kind" "RaceResultKind" NOT NULL,
    "rank" INTEGER NOT NULL,
    "wpm" DOUBLE PRECISION NOT NULL,
    "rawWpm" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "errors" INTEGER NOT NULL,
    "timeMs" INTEGER,
    "outcome" "RaceOutcome" NOT NULL,
    "wpmSeries" JSONB NOT NULL,
    "missedKeys" JSONB NOT NULL,
    "bonuses" JSONB NOT NULL,
    "isPersonalBest" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaceResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaceResult_userId_createdAt_idx" ON "RaceResult"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RaceResult" ADD CONSTRAINT "RaceResult_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceResult" ADD CONSTRAINT "RaceResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

