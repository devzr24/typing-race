import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { ErrorCode } from "@/i18n/messages";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./limits";

/** Retourne le code d'erreur (traduit par l'interface), ou null si le mot de passe est acceptable. */
export function validatePassword(password: string): ErrorCode | null {
  if (password.length === 0) return "required";
  if (password.length < PASSWORD_MIN_LENGTH) return "passwordTooShort";
  if (password.length > PASSWORD_MAX_LENGTH) return "passwordTooLong";
  return null;
}

// Paramètres scrypt recommandés par OWASP (N = 2^17, r = 8, p = 1).
const SCRYPT_PARAMS = { N: 2 ** 17, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function deriveKey(password: string, salt: Buffer, params: { N: number; r: number; p: number }) {
  const options: ScryptOptions = { ...params, maxmem: 256 * params.N * params.r };
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/**
 * Hache le mot de passe avec scrypt et un sel aléatoire.
 * Format stocké : scrypt$N$r$p$sel(base64)$hash(base64) — les paramètres sont gardés
 * pour pouvoir les durcir plus tard sans invalider les anciens hachages.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, SCRYPT_PARAMS);
  const { N, r, p } = SCRYPT_PARAMS;
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Compare un mot de passe à un hachage stocké, en temps constant. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every(Number.isSafeInteger)) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const actual = await deriveKey(password, salt, { N, r, p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
