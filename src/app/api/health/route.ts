import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

type MigrationRow = { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null };

/**
 * Diagnostic de production : version déployée, accès à la base et état des migrations.
 * Ne renvoie aucun secret ni aucune donnée d'utilisateur.
 */
export async function GET() {
  await connection();
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  try {
    const migrations = await prisma.$queryRaw<MigrationRow[]>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations" ORDER BY started_at`;
    const [{ exists }] = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT to_regclass('public."Room"') IS NOT NULL AS exists`;
    return Response.json({
      status: "ok",
      commit,
      database: "ok",
      roomTable: exists,
      migrations: migrations.map((m) => ({
        name: m.migration_name,
        state: m.rolled_back_at ? "annulée" : m.finished_at ? "appliquée" : "échouée",
      })),
    });
  } catch (error) {
    console.error("> /api/health :", error);
    return Response.json({ status: "erreur", commit, database: "inaccessible" }, { status: 503 });
  }
}
