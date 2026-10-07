import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Une seule instance par processus (le rechargement à chaud en dev en recréerait sinon).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  // Sans URL, le pilote pg se rabattrait silencieusement sur localhost:5432.
  if (!connectionString) {
    throw new Error("DATABASE_URL manquante : impossible de se connecter à PostgreSQL.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
