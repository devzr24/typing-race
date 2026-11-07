import { describe, expect, it } from "vitest";
import { credentialsSchema, guestSchema, providerSchema, registerSchema } from "./schemas";

describe("schémas d'authentification", () => {
  it.each([
    ["", "required"], ["  ", "required"], ["ab", "guestPseudoLength"],
    ["a".repeat(21), "guestPseudoLength"], ["a.b", "usernameChars"], ["_ab", "usernameStart"],
  ])("refuse le pseudo %j avec %s", (pseudo, error) => {
    const result = guestSchema.safeParse({ pseudo });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(error);
  });

  it.each(["abc", "a".repeat(20)])("accepte le pseudo %s", (pseudo) => {
    expect(guestSchema.parse({ pseudo })).toEqual({ pseudo });
  });

  it("normalise les pseudos et conserve la limite des comptes à 24", () => {
    expect(guestSchema.parse({ pseudo: " Alice " }).pseudo).toBe("alice");
    expect(credentialsSchema.safeParse({ username: "a".repeat(24), password: "password" }).success).toBe(true);
  });

  it.each([null, {}, { pseudo: 123 }, { pseudo: ["alice"] }])("refuse les types incorrects : %j", (value) => {
    expect(guestSchema.safeParse(value).success).toBe(false);
  });

  it("vérifie les identifiants, la confirmation et le fournisseur", () => {
    expect(credentialsSchema.safeParse({ username: 123, password: "password" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ username: "alice", password: "court" }).success).toBe(false);
    const result = registerSchema.safeParse({ username: "alice", password: "password", confirm: "autre" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]).toMatchObject({ path: ["confirm"], message: "passwordMismatch" });
    expect(providerSchema.safeParse("inconnu").success).toBe(false);
  });
});
