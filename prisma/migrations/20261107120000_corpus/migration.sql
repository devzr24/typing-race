-- Langues du corpus.
CREATE TYPE "TextLanguage" AS ENUM ('FR', 'EN');

-- Extraits littéraires et mots courants.
CREATE TABLE "Passage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "language" "TextLanguage" NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Passage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "language" "TextLanguage" NOT NULL,
    "value" TEXT NOT NULL,
    "frequencyRank" INTEGER NOT NULL,
    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Passage_slug_key" ON "Passage"("slug");
CREATE UNIQUE INDEX "Word_language_value_key" ON "Word"("language", "value");
CREATE INDEX "Word_language_frequencyRank_idx" ON "Word"("language", "frequencyRank");
