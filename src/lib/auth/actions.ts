"use server";

import { AuthError } from "next-auth";
import { Prisma } from "@/generated/prisma/client";
import { signIn, signOut } from "@/auth";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { normalizeUsername, validateUsername } from "@/lib/auth/username";
import { prisma } from "@/lib/prisma";

export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<"username" | "password" | "confirm" | "pseudo", string>>;
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
  if (!username) fieldErrors.username = "Le nom d'utilisateur est obligatoire.";
  if (!password) fieldErrors.password = "Le mot de passe est obligatoire.";
  if (fieldErrors.username || fieldErrors.password) return { fieldErrors, values };

  try {
    await signIn("credentials", { username, password, redirectTo: "/" });
  } catch (error) {
    // signIn lance une redirection en cas de succès : seule une AuthError est un échec.
    if (error instanceof AuthError) {
      return { error: "Nom d'utilisateur ou mot de passe incorrect.", values };
    }
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
  else if (password !== confirm) fieldErrors.confirm = "Les mots de passe ne correspondent pas.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  try {
    await prisma.user.create({
      data: { username, passwordHash: await hashPassword(password) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fieldErrors: { username: "Ce nom d'utilisateur est déjà pris." }, values };
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
  if (pseudo) {
    const pseudoError = validateUsername(pseudo);
    if (pseudoError) {
      return { fieldErrors: { pseudo: pseudoError.replace("Le nom d'utilisateur", "Le pseudo") }, values };
    }
  }

  try {
    await signIn("guest", { pseudo, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Impossible de continuer en invité. Réessaie.", values };
    }
    throw error;
  }
  return {};
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
