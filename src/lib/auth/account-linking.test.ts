import { describe, expect, it } from "vitest";
import { canLinkAccount } from "./account-linking";

describe("canLinkAccount", () => {
  it("autorise le premier compte d'un nouvel utilisateur OAuth", () => {
    expect(canLinkAccount(null, 0)).toBe(true);
  });

  it("refuse un utilisateur avec mot de passe", () => {
    expect(canLinkAccount("scrypt$hash", 0)).toBe(false);
    expect(canLinkAccount("scrypt$hash", 1)).toBe(false);
  });

  it("refuse un utilisateur ayant déjà un compte OAuth", () => {
    expect(canLinkAccount(null, 1)).toBe(false);
    expect(canLinkAccount(null, 2)).toBe(false);
  });
});
