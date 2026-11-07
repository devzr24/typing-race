import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runMigrations, runSeed, shouldMigrateOnStart } from "./migrate";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

afterEach(() => vi.resetAllMocks());

describe("shouldMigrateOnStart", () => {
  it("migre au démarrage en production sur Railway", () => {
    expect(shouldMigrateOnStart({ NODE_ENV: "production", RAILWAY_ENVIRONMENT: "production" })).toBe(true);
  });

  it("ne migre pas pour un npm start local", () => {
    expect(shouldMigrateOnStart({ NODE_ENV: "production" })).toBe(false);
  });

  it("ne migre pas en développement", () => {
    expect(shouldMigrateOnStart({ NODE_ENV: "development", RAILWAY_ENVIRONMENT: "x" })).toBe(false);
  });
});

describe("commandes Prisma au démarrage", () => {
  it.each([
    ["migrations", runMigrations, ["prisma", "migrate", "deploy"], "inherit"],
    ["seed", runSeed, ["prisma", "db", "seed"], "pipe"],
  ] as const)("lance %s avec la bonne commande", (_name, run, args, stdio) => {
    run();
    expect(execFileSync).toHaveBeenCalledExactlyOnceWith("npx", args, {
      stdio,
      shell: process.platform === "win32",
    });
  });

  it("journalise un échec du seed sans arrêter le démarrage", () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Seed impossible");
    vi.mocked(execFileSync).mockImplementationOnce(() => { throw error; });
    expect(() => runSeed()).not.toThrow();
    expect(logError).toHaveBeenCalledExactlyOnceWith(
      "Échec du chargement du corpus Prisma ; le démarrage continue.",
    );
    logError.mockRestore();
  });
});
