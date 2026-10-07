import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // env() lève une erreur explicite si DATABASE_URL manque (au lieu de localhost par défaut).
    url: env("DATABASE_URL"),
  },
});
