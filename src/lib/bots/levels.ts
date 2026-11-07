// Plages MPM et taux d'erreur de l'énoncé ; Impossible (140+) est borné à 170.
// minWpm/maxWpm : MPM nets ; errorRate : erreurs / frappes, corrections incluses.
export type BotLevel =
  | "noob"
  | "beginner"
  | "intermediate"
  | "expert"
  | "impossible";

export interface BotLevelConfig {
  readonly minWpm: number;
  readonly maxWpm: number;
  readonly errorRate: number;
}

export const BOT_LEVELS = {
  noob: { minWpm: 10, maxWpm: 20, errorRate: 0.12 },
  beginner: { minWpm: 20, maxWpm: 35, errorRate: 0.08 },
  intermediate: { minWpm: 35, maxWpm: 60, errorRate: 0.05 },
  expert: { minWpm: 70, maxWpm: 100, errorRate: 0.02 },
  impossible: { minWpm: 140, maxWpm: 170, errorRate: 0.005 },
} as const satisfies Record<BotLevel, BotLevelConfig>;
