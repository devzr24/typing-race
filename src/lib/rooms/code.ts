import type { ErrorCode } from "@/i18n/messages";

// Sans 0/O, 1/I/L : aucun caractère qu'on confond en le lisant au tableau ou en le dictant.
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Majuscules, sans espaces ni tirets : « abc-def » et « ABC DEF » donnent « ABCDEF ». */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]+/g, "");
}

/** Retourne le code d'erreur (traduit par l'interface), ou null si le code (déjà normalisé) est valide. */
export function validateRoomCode(code: string): ErrorCode | null {
  if (code.length === 0) return "roomCodeRequired";
  if (!ROOM_CODE_PATTERN.test(code)) return "roomCodeInvalid";
  return null;
}
