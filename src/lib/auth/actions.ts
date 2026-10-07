"use server";

import { AuthError } from "next-auth";
import { Prisma } from "@/generated/prisma/client";
import { signIn, signOut } from "@/auth";
import type { ErrorCode } from "@/i18n/messages";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { normalizeUsername, validateUsername } from "@/lib/auth/username";
import { prisma } from "@/lib/prisma";

/** Les erreurs sont des codes, traduits par l'interface dans la langue choisie. */
export type FormState = {
  error?: ErrorCode;
  fieldErrors?: Partial<Record<"username" | "password" | "confirm" | "pseudo", ErrorCode>>;
  values?: { username?: string; pseudo?: string };
};

const OAUTH_PROVIDERS = ["github", "discord"] as const;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = field(formData, "provider");
  if (!OAUTH_PROVIDERS.includes(provider as (typeof OAUTH_PROVIDERS)[number])) return;
  await signIn(provider, { redirectTo: "/" });
}

export async function loginWithPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = normalizeUsername(field(formData, "username"));
  const password = field(formData, "password");
  const values = { username };

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!username) fieldErrors.username = "required";
  if (!password) fieldErrors.password = "required";
  if (fieldErrors.username || fieldErrors.password) return { fieldErrors, values };

  try {
    await signIn("credentials", { username, password, redirectTo: "/" });
  } catch (error) {
    // signIn lance une redirection en cas de succès : seule une AuthError est un échec.
    if (error instanceof AuthError) return { error: "invalidLogin", values };
    throw error;
  }
  return {};
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = normalizeUsername(field(formData, "username"));
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");
  const values = { username };

  const fieldErrors: FormState["fieldErrors"] = {};
  const usernameError = validateUsername(username);
  if (usernameError) fieldErrors.username = usernameError;
  const passwordError = validatePassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  else if (password !== confirm) fieldErrors.confirm = "passwordMismatch";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  try {
    await prisma.user.create({
      data: { username, passwordHash: await hashPassword(password) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fieldErrors: { username: "usernameTaken" }, values };
    }
    throw error;
  }

  // Compte créé : on connecte directement l'utilisateur.
  await signIn("credentials", { username, password, redirectTo: "/" });
  return {};
}

export async function continueAsGuest(_prev: FormState, formData: FormData): Promise<FormState> {
  const pseudo = normalizeUsername(field(formData, "pseudo"));
  const values = { pseudo };

  // Pseudo facultatif : s'il est vide, un pseudo est généré (ex. invite-4821).
  const pseudoError = pseudo ? validateUsername(pseudo) : null;
  if (pseudoError) return { fieldErrors: { pseudo: pseudoError }, values };

  try {
    await signIn("guest", { pseudo, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "guestFailed", values };
    throw error;
  }
  return {};
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
