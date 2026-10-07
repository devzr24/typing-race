import { describe, expect, it } from "vitest";
import { ROOM_CODE_ALPHABET, normalizeRoomCode, validateRoomCode } from "./code";
import { generateRoomCode, generateUniqueRoomCode } from "./code-generator";

describe("ROOM_CODE_ALPHABET", () => {
  it("ne contient aucun caractère ambigu", () => {
    for (const ambiguous of ["0", "O", "1", "I", "L"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });
});

describe("generateRoomCode", () => {
  it("produit 6 caractères de l'alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
      expect(validateRoomCode(code)).toBeNull();
    }
  });

  it("produit des codes variés", () => {
    // Une collision reste possible par hasard (≈ 1 chance sur 1800) : on tolère quelques doublons.
    const codes = new Set(Array.from({ length: 1000 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(995);
  });
});

describe("generateUniqueRoomCode", () => {
  it("évite les codes déjà pris", async () => {
    const queue = ["AAAAAA", "BBBBBB", "CCCCCC"];
    const taken = new Set(["AAAAAA", "BBBBBB"]);
    const code = await generateUniqueRoomCode(
      async (c) => taken.has(c),
      () => queue.shift()!,
    );
    expect(code).toBe("CCCCCC");
  });

  it("abandonne après trop de collisions", async () => {
    await expect(
      generateUniqueRoomCode(async () => true, () => "AAAAAA", 3),
    ).rejects.toThrow();
  });
});

describe("normalizeRoomCode / validateRoomCode", () => {
  it("accepte minuscules, espaces et tirets", () => {
    expect(normalizeRoomCode(" abc-def ")).toBe("ABCDEF");
    expect(normalizeRoomCode("abc def")).toBe("ABCDEF");
  });

  it("refuse un code vide", () => {
    expect(validateRoomCode("")).toBe("roomCodeRequired");
  });

  it("refuse une mauvaise longueur ou un caractère ambigu", () => {
    for (const code of ["ABCDE", "ABCDEFG", "ABCDE0", "ABCDEI"]) {
      expect(validateRoomCode(code)).toBe("roomCodeInvalid");
    }
  });
});
