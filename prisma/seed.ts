import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { loadSeedData } from "./corpus/load";

loadSeedData(prisma)
  .catch((error: unknown) => {
    console.error("> Échec du seed Prisma :", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());