import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/auth/limits";
import { ROOM_CODE_LENGTH } from "@/lib/rooms/code";
import type { ErrorCode, Messages } from "./messages";

/** Variables disponibles dans tous les textes : les limites de validation. */
const LIMITS = {
  usernameMin: USERNAME_MIN_LENGTH,
  usernameMax: USERNAME_MAX_LENGTH,
  passwordMin: PASSWORD_MIN_LENGTH,
  passwordMax: PASSWORD_MAX_LENGTH,
  codeLength: ROOM_CODE_LENGTH,
};

/** Remplace les {variables} d'un texte ; les limites de validation sont toujours disponibles. */
export function format(template: string, vars: Record<string, string | number> = {}): string {
  const values: Record<string, string | number> = { ...LIMITS, ...vars };
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/** Texte d'une erreur à partir de son code (renvoyé par les validations et les actions). */
export function errorText(m: Messages, code: ErrorCode): string {
  return format(m.errors[code]);
}
