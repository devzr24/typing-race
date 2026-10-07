import { defineConfig, devices } from "@playwright/test";

// Port dédié aux tests, pour ne pas entrer en conflit avec `npm run dev` (3000).
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  // Les tests partagent une base de données : on les exécute l'un après l'autre.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Serveur de production (server.ts : Next.js + Socket.IO) ; `npm run build` doit être fait avant.
  // Variables requises : DATABASE_URL (base migrée) et AUTH_SECRET.
  webServer: {
    command: "npm start",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT: String(PORT) },
  },
});
