import type { Session } from "next-auth";
import type { Identity } from "./types";

/** Identité de salle à partir de la session Auth.js (utilisateur inscrit ou invité). */
export function identityFromSession(session: Session | null): Identity | null {
  const user = session?.user;
  if (!user?.id || !user.username) return null;
  return {
    key: user.id,
    displayName: user.username,
    image: user.image ?? null,
    isGuest: user.isGuest,
  };
}
