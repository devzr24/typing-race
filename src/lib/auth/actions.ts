"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { signIn, signOut } from "@/auth";
import type { ErrorCode } from "@/i18n/messages";
import { hashPassword, ScryptQueueFullError } from "@/lib/auth/password";
import { authRateLimiter, clientIp } from "@/lib/auth/rate-limit";
import { normalizeUsername } from "@/lib/auth/username";
import { authFieldErrors, credentialsSchema, guestSchema, providerSchema, registerSchema } from "@/lib/auth/schemas";
import { prisma } from "@/lib/prisma";

/** Les erreurs sont des codes, traduits par l'interface dans la langue choisie. */
export type FormState = {
  error?: ErrorCode;
  fieldErrors?: Partial<Record<"username" | "password" | "confirm" | "pseudo", ErrorCode>>;
  values?: { username?: string; pseudo?: string };
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = providerSchema.safeParse(field(formData, "provider"));
  if (!provider.success) return;
  await signIn(provider.data, { redirectTo: "/" });
}

export async function loginWithPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = normalizeUsername(field(formData, "username"));
  const password = field(formData, "password");
  const values = { username };

  const parsed = credentialsSchema.safeParse({ username, password });
  if (!parsed.success) {
    const fieldErrors: FormState["fieldErrors"] = {};
    if (!username) fieldErrors.username = "required";
    if (!password) fieldErrors.password = "required";
    return Object.keys(fieldErrors).length ? { fieldErrors, values } : { error: "invalidLogin", values };
  }

  try {
    await signIn("credentials", { username, password, redirectTo: "/" });
  } catch (error) {
    // signIn lance une redirection en cas de succès : seule une AuthError est un échec.
    if (error instanceof CredentialsSignin && error.code === "rate_limited") {
      return { error: "tooManyAttempts", values };
    }
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

  const parsed = registerSchema.safeParse({ username, password, confirm });
  if (!parsed.success) return { fieldErrors: authFieldErrors(parsed.error), values };

  if (!authRateLimiter.consume(`register:ip:${clientIp(await headers())}`, 5, 60 * 60_000)) {
    return { error: "tooManyAttempts", values };
  }

  try {
    await prisma.user.create({
      data: { username, passwordHash: await hashPassword(password) },
    });
  } catch (error) {
    if (error instanceof ScryptQueueFullError) return { error: "tooManyAttempts", values };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fieldErrors: { username: "usernameTaken" }, values };
    }
    throw error;
  }

  // Compte créé : on connecte directement l'utilisateur.
  return loginWithPassword(_prev, formData);
}

export async function continueAsGuest(_prev: FormState, formData: FormData): Promise<FormState> {
  const pseudo = normalizeUsername(field(formData, "pseudo"));
  const values = { pseudo };

  const parsed = guestSchema.safeParse({ pseudo });
  if (!parsed.success) return { fieldErrors: authFieldErrors(parsed.error), values };

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
