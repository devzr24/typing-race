// Sans 0/O, 1/I/L : aucun caractère qu'on confond en le lisant au tableau ou en le dictant.
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Majuscules, sans espaces ni tirets : « abc-def » et « ABC DEF » donnent « ABCDEF ». */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]+/g, "");
}

/** Retourne un message d'erreur en français, ou null si le code (déjà normalisé) est valide. */
export function validateRoomCode(code: string): string | null {
  if (code.length === 0) return "Entre le code de la salle.";
  if (!ROOM_CODE_PATTERN.test(code)) {
    return `Code invalide : il fait ${ROOM_CODE_LENGTH} caractères, lettres et chiffres, sans 0, O, 1, I ni L.`;
  }
  return null;
}
