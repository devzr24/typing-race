export interface TextConfig {
  textLanguage: "FR" | "EN";
  textType: "COHERENT" | "ALEATOIRE";
  wordCount: number;
  complexity: "FACILE" | "MOYEN" | "DIFFICILE";
  punctuation: boolean;
  numbers: boolean;
  capitals: boolean;
  accents: boolean;
  includeChars: string;
  excludeChars: string;
}

export type TextFailure = "NOT_ENOUGH_WORDS" | "NO_PASSAGE";
export type TextResult = { ok: true; text: string } | { ok: false; reason: TextFailure };

export interface TextWord {
  language: TextConfig["textLanguage"];
  value: string;
  frequencyRank: number;
}

export interface TextPassage {
  language: TextConfig["textLanguage"];
  content: string;
}
