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
