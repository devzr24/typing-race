import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "./password";

describe("validatePassword", () => {
  it("accepte un mot de passe de 8 à 128 caractères", () => {
    expect(validatePassword("12345678")).toBeNull();
    expect(validatePassword("x".repeat(128))).toBeNull();
  });

  it("refuse un mot de passe vide", () => {
    expect(validatePassword("")).toMatch(/obligatoire/);
  });

  it("refuse un mot de passe trop court", () => {
    expect(validatePassword("1234567")).toMatch(/au moins 8/);
  });

  it("refuse un mot de passe trop long", () => {
    expect(validatePassword("x".repeat(129))).toMatch(/dépasser 128/);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("ne stocke jamais le mot de passe en clair", async () => {
    const hash = await hashPassword("motdepasse-secret");
    expect(hash).not.toContain("motdepasse-secret");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("accepte le bon mot de passe", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
  });

  it("refuse un mauvais mot de passe", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("Correct horse", hash)).toBe(false);
  });

  it("produit un hachage différent à chaque fois (sel aléatoire)", async () => {
    const [a, b] = await Promise.all([hashPassword("pareil123"), hashPassword("pareil123")]);
    expect(a).not.toBe(b);
    expect(await verifyPassword("pareil123", a)).toBe(true);
    expect(await verifyPassword("pareil123", b)).toBe(true);
  });

  it("refuse un hachage mal formé sans planter", async () => {
    expect(await verifyPassword("abc", "pas-un-hash")).toBe(false);
    expect(await verifyPassword("abc", "scrypt$x$y$z$a$b")).toBe(false);
  });
});
