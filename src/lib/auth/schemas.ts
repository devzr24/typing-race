import { z } from "zod";
import type { ErrorCode } from "@/i18n/messages";
import { GUEST_PSEUDO_MAX_LENGTH, GUEST_PSEUDO_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./limits";
import { normalizeUsername, validateUsername } from "./username";

/** Validation pure, également réexportée par le module de hachage. */
export function validatePassword(password: string): ErrorCode | null {
  if (password.length === 0) return "required";
  if (password.length < PASSWORD_MIN_LENGTH) return "passwordTooShort";
  if (password.length > PASSWORD_MAX_LENGTH) return "passwordTooLong";
  return null;
}

const usernameSchema = z.string({ error: "required" }).transform(normalizeUsername).superRefine((value, ctx) => {
  const error = validateUsername(value);
  if (error) ctx.addIssue({ code: "custom", message: error });
});
const passwordSchema = z.string({ error: "required" }).superRefine((value, ctx) => {
  const error = validatePassword(value);
  if (error) ctx.addIssue({ code: "custom", message: error });
});

export const providerSchema = z.enum(["github", "discord"]);
// Auth.js ajoute ses propres champs : seuls les identifiants sont conservés.
export const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });
export const registerSchema = credentialsSchema.extend({ confirm: z.string({ error: "passwordMismatch" }) })
  .superRefine((value, ctx) => {
    if (!validatePassword(value.password) && value.password !== value.confirm) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "passwordMismatch" });
    }
  });
export const guestSchema = z.object({
  pseudo: z.string({ error: "required" }).transform(normalizeUsername).superRefine((value, ctx) => {
    const error = !value ? "required"
      : value.length < GUEST_PSEUDO_MIN_LENGTH || value.length > GUEST_PSEUDO_MAX_LENGTH
        ? "guestPseudoLength" : validateUsername(value);
    if (error) ctx.addIssue({ code: "custom", message: error });
  }),
});

/** Les schémas de formulaire n'émettent que des codes publics. */
export function authFieldErrors(error: z.ZodError): Partial<Record<"username" | "password" | "confirm" | "pseudo", ErrorCode>> {
  const errors: Partial<Record<"username" | "password" | "confirm" | "pseudo", ErrorCode>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "username" || field === "password" || field === "confirm" || field === "pseudo") {
      errors[field] = issue.message as ErrorCode;
    }
  }
  return errors;
}
