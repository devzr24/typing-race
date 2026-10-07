import { randomInt } from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./code";

/** Tire un code au hasard (générateur cryptographique par défaut, remplaçable pour les tests). */
export function generateRoomCode(randomIndex: (max: number) => number = randomInt): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomIndex(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Tire des codes jusqu'à en trouver un libre. Avec 31^6 ≈ 887 millions de codes,
 * une collision est rarissime ; la contrainte d'unicité en base reste le dernier rempart.
 */
export async function generateUniqueRoomCode(
  isTaken: (code: string) => Promise<boolean>,
  generate: () => string = generateRoomCode,
  maxAttempts = 20,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generate();
    if (!(await isTaken(code))) return code;
  }
  throw new Error("Impossible de générer un code de salle libre.");
}
