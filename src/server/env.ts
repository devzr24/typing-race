/** Variables sans lesquelles l'application ne doit pas démarrer en production. */
export const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "AUTH_SECRET"] as const;
/** En plus, sur Railway : derrière son proxy, Auth.js a besoin de l'URL publique. */
export const REQUIRED_ON_RAILWAY = ["AUTH_URL"] as const;

export function missingVariables(
  env: Record<string, string | undefined>,
  names: readonly string[],
): string[] {
  return names.filter((name) => !env[name]?.trim());
}

/**
 * En production, lève une erreur claire si une variable obligatoire manque, plutôt que
 * de laisser une bibliothèque se rabattre sur une valeur par défaut (ex. localhost:5432).
 * Railway définit RAILWAY_ENVIRONMENT automatiquement ; `npm start` en local n'exige pas AUTH_URL.
 */
export function assertProductionEnv(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV !== "production") return;
  const required: string[] = [...REQUIRED_IN_PRODUCTION];
  if (env.RAILWAY_ENVIRONMENT) required.push(...REQUIRED_ON_RAILWAY);
  const missing = missingVariables(env, required);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes : ${missing.join(", ")}. ` +
        "Ajoute-les dans Railway (service de l'application → Variables).",
    );
  }
}
