import { describe, expect, it } from "vitest";
import { shouldMigrateOnStart } from "./migrate";

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
