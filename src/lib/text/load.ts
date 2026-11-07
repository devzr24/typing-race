import { prisma } from "../prisma";
import { generateCoherentText, generateRandomText } from "./generate";
import type { TextConfig, TextResult } from "./types";

export async function loadRaceText(config: TextConfig, seed: number): Promise<TextResult> {
  if (config.textType === "ALEATOIRE") {
    const words = await prisma.word.findMany({
      where: { language: config.textLanguage },
      orderBy: [{ frequencyRank: "asc" }, { value: "asc" }],
      select: { language: true, value: true, frequencyRank: true },
    });
    return generateRandomText(words, config, seed);
  }
  const passages = await prisma.passage.findMany({
    where: { language: config.textLanguage },
    orderBy: { slug: "asc" },
    select: { language: true, content: true },
  });
  return generateCoherentText(passages, config, seed);
}
