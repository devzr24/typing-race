import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import GitHub from "next-auth/providers/github";
import { randomUUID } from "node:crypto";
import { Prisma, type User } from "@/generated/prisma/client";
import { generateGuestName } from "@/lib/auth/guest";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import {
  findAvailableUsername,
  normalizeUsername,
  usernameFromProvider,
  validateUsername,
} from "@/lib/auth/username";
import { prisma } from "@/lib/prisma";

class InvalidLoginError extends CredentialsSignin {
  code = "invalid_login";
}

// Hachage factice : on vérifie quand même un mot de passe si le nom n'existe pas,
// pour que le temps de réponse ne révèle pas quels noms sont inscrits.
// Calculé au premier besoin (pas au chargement du module, qui a lieu pendant le pré-rendu).
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomUUID());
  return dummyHashPromise;
}

// Auth.js attend un courriel sur l'utilisateur ; nous n'en stockons pas (ADR 0004).
function toAdapterUser(user: User): AdapterUser {
  return { ...user, email: "", emailVerified: null };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const baseAdapter = PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]);

const adapter: Adapter = {
  ...baseAdapter,
  // Premier passage par GitHub/Discord : nom unique avec suffixe numérique si pris (ADR 0005).
  async createUser(data) {
    const base = usernameFromProvider(data.username ?? data.name ?? "");
    const isTaken = async (candidate: string) =>
      (await prisma.user.count({ where: { username: candidate } })) > 0;
    // Plusieurs tentatives au cas où deux inscriptions simultanées visent le même nom.
    for (let attempt = 0; attempt < 5; attempt++) {
      const username = await findAvailableUsername(base, isTaken);
      try {
        const user = await prisma.user.create({
          data: { username, name: data.name ?? null, image: data.image ?? null },
        });
        return toAdapterUser(user);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new Error("Impossible de créer un nom d'utilisateur unique.");
  },
  // On ne conserve pas les jetons d'accès GitHub/Discord : on n'appelle pas leurs API.
  async linkAccount({ userId, type, provider, providerAccountId }) {
    await prisma.account.create({ data: { userId, type, provider, providerAccountId } });
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  // Les connexions par mot de passe imposent des sessions JWT (cookie chiffré).
  session: { strategy: "jwt" },
  // Railway place l'application derrière un proxy : on fait confiance à l'en-tête Host transmis.
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user" } },
      profile(profile) {
        return {
          id: String(profile.id),
          username: profile.login,
          name: profile.name ?? profile.login,
          email: null,
          image: profile.avatar_url,
        };
      },
    }),
    Discord({
      authorization: { params: { scope: "identify" } },
      profile(profile) {
        const image = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith("a_") ? "gif" : "png"}`
          : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(profile.id) >> BigInt(22)) % 6}.png`;
        return {
          id: profile.id,
          username: profile.username,
          name: profile.global_name ?? profile.username,
          email: null,
          image,
        };
      },
    }),
    Credentials({
      id: "credentials",
      credentials: { username: {}, password: {} },
      async authorize(credentials) {
        const username = normalizeUsername(String(credentials.username ?? ""));
        const password = String(credentials.password ?? "");
        if (validateUsername(username) || validatePassword(password)) {
          throw new InvalidLoginError();
        }
        const user = await prisma.user.findUnique({ where: { username } });
        const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
        if (!user?.passwordHash || !valid) throw new InvalidLoginError();
        return { id: user.id, username: user.username, name: user.name, image: user.image };
      },
    }),
    // Invité : aucune donnée en base, tout tient dans le jeton de session.
    Credentials({
      id: "guest",
      credentials: { pseudo: {} },
      authorize(credentials) {
        const raw = normalizeUsername(String(credentials.pseudo ?? ""));
        const pseudo = raw === "" ? generateGuestName() : raw;
        if (validateUsername(pseudo)) throw new CredentialsSignin();
        return { id: `guest-${randomUUID()}`, username: pseudo, name: pseudo, isGuest: true };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.username = user.username;
        token.picture = user.image ?? null;
        token.isGuest = user.isGuest ?? false;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.username = token.username ?? "";
      session.user.image = token.picture ?? null;
      session.user.isGuest = token.isGuest ?? false;
      return session;
    },
  },
});
