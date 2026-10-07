import type { ErrorCode } from "@/i18n/messages";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "./limits";

const ALLOWED_CHARS = /^[a-z0-9_-]+$/;
const STARTS_WITH_ALPHANUMERIC = /^[a-z0-9]/;

/** Les noms d'utilisateur sont stockés en minuscules : « Alex » et « alex » sont le même nom. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** Retourne le code d'erreur (traduit par l'interface), ou null si le nom (déjà normalisé) est valide. */
export function validateUsername(username: string): ErrorCode | null {
  if (username.length === 0) return "required";
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return "usernameLength";
  }
  if (!ALLOWED_CHARS.test(username)) return "usernameChars";
  if (!STARTS_WITH_ALPHANUMERIC.test(username)) return "usernameStart";
  return null;
}

/**
 * Transforme un nom venant de GitHub ou Discord en nom valide selon nos règles
 * (Discord autorise par exemple le point, que nous n'acceptons pas).
 */
export function usernameFromProvider(raw: string): string {
  let name = normalizeUsername(raw)
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
  if (name.length === 0) name = "joueur";
  return name.padEnd(USERNAME_MIN_LENGTH, "_");
}

/**
 * Trouve le premier nom libre : « alex », puis « alex-2 », « alex-3 »…
 * La base est raccourcie si nécessaire pour que le suffixe tienne dans la longueur maximale.
 */
export async function findAvailableUsername(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 1000,
): Promise<string> {
  if (!(await isTaken(base))) return base;
  for (let n = 2; n <= maxAttempts; n++) {
    const suffix = `-${n}`;
    const candidate = base.slice(0, USERNAME_MAX_LENGTH - suffix.length) + suffix;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(`Aucun nom d'utilisateur libre trouvé pour « ${base} ».`);
}
