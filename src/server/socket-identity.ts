import { getToken } from "next-auth/jwt";
import type { Identity } from "@/lib/rooms/types";

// Noms du cookie de session Auth.js : préfixe __Secure- en HTTPS (production).
const SESSION_COOKIES = [
  { name: "__Secure-authjs.session-token", secure: true },
  { name: "authjs.session-token", secure: false },
];

/**
 * Identité Socket.IO tirée du cookie de session Auth.js, déchiffré avec AUTH_SECRET.
 * Le client ne déclare jamais qui il est : sans cookie valide, la connexion est refusée.
 */
export async function identityFromCookieHeader(cookieHeader: string | undefined): Promise<Identity | null> {
  if (!cookieHeader) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant : impossible de vérifier les sessions Socket.IO.");

  for (const cookie of SESSION_COOKIES) {
    if (!cookieHeader.includes(cookie.name)) continue;
    const token = await getToken({
      // Seul l'en-tête cookie est transmis : pas d'en-tête Authorization accepté.
      req: { headers: { cookie: cookieHeader } },
      secret,
      secureCookie: cookie.secure,
      cookieName: cookie.name,
      salt: cookie.name,
    });
    if (token?.sub && token.username) {
      return {
        key: token.sub,
        displayName: token.username,
        image: token.picture ?? null,
        isGuest: token.isGuest ?? false,
      };
    }
  }
  return null;
}
