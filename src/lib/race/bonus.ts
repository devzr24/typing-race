/**
 * Checkpoints au dépassement strict de 25/50/75 %, mémorisés par la course.
 * Retard : dernier actif (progression, puis arrivée) ou écart strictement > 25 points.
 * Le meneur (premier non abandonné), les finis et les abandonnés ne reçoivent rien.
 * Un bonus par retardataire et checkpoint, au plus trois par course ; graine entière.
 * minus3 cible le bénéficiaire ; plus3 et fog ciblent le meneur (brouillard 4 s).
 * Ajout en fin de texte ; retrait depuis la fin, sans toucher le préfixe validé,
 * ni le mot en cours. Au moins un mot non terminé reste ; texte terminé inchangé.
 * Positions en caractères UTF-16 (comme slice), mots séparés par des espaces blancs.
 */
export const CHECKPOINTS = [0.25, 0.5, 0.75] as const;
export type Checkpoint = typeof CHECKPOINTS[number];
export const MAX_BONUSES_PER_PLAYER = 3;
export const LAG_THRESHOLD = 0.25;
export const EPSILON = 1e-9;
export const FOG_DURATION_MS = 4_000;
export const BONUS_TYPES = ["minus3", "plus3", "fog"] as const;
export type BonusType = typeof BONUS_TYPES[number];

export interface BonusParticipant {
  id: string;
  status: "racing" | "finished" | "abandoned";
  progress: number;
  joinedAt: number;
  bonusesReceived: number;
}

export function crossedCheckpoints(previous: number, current: number, used: readonly Checkpoint[] = []): Checkpoint[] {
  return CHECKPOINTS.filter((point) => previous <= point && current > point && !used.includes(point));
}

function currentOrder(participants: readonly BonusParticipant[]): BonusParticipant[] {
  return participants.filter((player) => player.status !== "abandoned")
    .sort((a, b) => b.progress - a.progress || a.joinedAt - b.joinedAt);
}

export function isLaggingPlayer(player: BonusParticipant, participants: readonly BonusParticipant[]): boolean {
  const order = currentOrder(participants);
  const leader = order[0];
  const active = order.filter((entry) => entry.status === "racing");
  return player.status === "racing" && leader !== undefined && player.id !== leader.id
    && (active[active.length - 1]?.id === player.id || leader.progress - player.progress > LAG_THRESHOLD + EPSILON);
}

export function chooseBonusType(seed: number): BonusType {
  const value = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return BONUS_TYPES[value % BONUS_TYPES.length];
}

export interface BonusGrant {
  playerId: string;
  targetId: string;
  checkpoint: Checkpoint;
  type: BonusType;
}

// Le serveur conserve les checkpoints retournés et incrémente les compteurs reçus.
export function allocateBonuses({ participants, previous, current, used = [], seed }: {
  participants: readonly BonusParticipant[];
  previous: number;
  current: number;
  used?: readonly Checkpoint[];
  seed: number;
}): { grants: BonusGrant[]; used: Checkpoint[] } {
  const crossed = crossedCheckpoints(previous, current, used);
  const order = currentOrder(participants);
  const leader = order[0];
  const grants: BonusGrant[] = [];
  if (leader) {
    for (const player of order) {
      if (!isLaggingPlayer(player, participants)) continue;
      let count = player.bonusesReceived;
      for (const checkpoint of crossed) {
        if (count >= MAX_BONUSES_PER_PLAYER) break;
        const type = chooseBonusType(seed + grants.length);
        grants.push({ playerId: player.id, targetId: type === "minus3" ? player.id : leader.id, checkpoint, type });
        count++;
      }
    }
  }
  return { grants, used: [...new Set([...used, ...crossed])] };
}

function checkPosition(text: string, position: number): void {
  if (!Number.isSafeInteger(position) || position < 0 || position > text.length) {
    throw new RangeError("INVALID_POSITION");
  }
}

export function addWords(text: string, position: number, words: readonly string[]): string {
  checkPosition(text, position);
  const addition = words.join(" ").split(/\s+/).filter(Boolean).join(" ");
  if (!addition || !/\S/.test(text.slice(position))) return text;
  return text + (/\s$/.test(text) ? "" : " ") + addition;
}

export function removeWords(text: string, position: number, count: number): string {
  checkPosition(text, position);
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError("INVALID_COUNT");
  const remaining = [...text.matchAll(/\S+/g)].filter((word) => word.index + word[0].length > position);
  const removed = Math.min(count, remaining.length - 1);
  if (removed <= 0) return text;
  const lastKept = remaining[remaining.length - removed - 1];
  return text.slice(0, lastKept.index + lastKept[0].length);
}
