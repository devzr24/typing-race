import { execFileSync } from "node:child_process";

/** Les migrations sont appliquées au démarrage sur Railway uniquement (ADR 0008). */
export function shouldMigrateOnStart(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "production" && Boolean(env.RAILWAY_ENVIRONMENT);
}

/** Lance `prisma migrate deploy` ; lève une erreur (donc arrêt du serveur) si une migration échoue. */
export function runMigrations(): void {
  console.log("> Application des migrations Prisma…");
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

/** Charge le corpus et les comptes de démonstration ; journalise un échec sans arrêter le démarrage. */
export function runSeed(): void {
  console.log("> Chargement du corpus Prisma…");
  try {
    execFileSync("npx", ["prisma", "db", "seed"], {
      stdio: "pipe",
      shell: process.platform === "win32",
    });
  } catch {
    console.error("Échec du chargement du corpus Prisma ; le démarrage continue.");
  }
}
