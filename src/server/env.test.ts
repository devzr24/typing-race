import { describe, expect, it } from "vitest";
import { assertProductionEnv, missingVariables } from "./env";

const local = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@h:5432/db",
  AUTH_SECRET: "secret",
};
const railway = {
  ...local,
  RAILWAY_ENVIRONMENT: "production",
  AUTH_URL: "https://exemple.up.railway.app",
};

describe("missingVariables", () => {
  it("liste les variables absentes ou vides", () => {
    expect(missingVariables({ A: "1", B: "", C: "  " }, ["A", "B", "C", "D"])).toEqual(["B", "C", "D"]);
  });
});

describe("assertProductionEnv", () => {
  it("accepte une configuration Railway complète", () => {
    expect(() => assertProductionEnv(railway)).not.toThrow();
  });

  it("plante clairement si DATABASE_URL manque en production", () => {
    expect(() => assertProductionEnv({ ...railway, DATABASE_URL: undefined })).toThrow(
      /manquantes : DATABASE_URL/,
    );
  });

  it("exige AUTH_URL sur Railway", () => {
    expect(() => assertProductionEnv({ ...railway, AUTH_URL: "" })).toThrow(/manquantes : AUTH_URL/);
  });

  it("n'exige pas AUTH_URL pour un npm start local", () => {
    expect(() => assertProductionEnv(local)).not.toThrow();
  });

  it("liste toutes les variables manquantes", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "production", RAILWAY_ENVIRONMENT: "production" })).toThrow(
      /DATABASE_URL, AUTH_SECRET, AUTH_URL/,
    );
  });

  it("ne vérifie rien en développement", () => {
    expect(() => assertProductionEnv({ NODE_ENV: "development" })).not.toThrow();
  });
});
