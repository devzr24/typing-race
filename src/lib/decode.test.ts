import { describe, expect, it } from "vitest";
import { ROOM_CODE_ALPHABET } from "@/lib/rooms/code";
import { decodeFrame } from "./decode";

describe("decodeFrame", () => {
  it("garde la longueur du code", () => {
    for (let settled = 0; settled <= 6; settled++) {
      expect(decodeFrame("K7MPQ2", settled)).toHaveLength(6);
    }
  });

  it("fixe les lettres déjà décodées", () => {
    expect(decodeFrame("K7MPQ2", 3).slice(0, 3)).toBe("K7M");
  });

  it("affiche le code exact une fois toutes les lettres fixées", () => {
    expect(decodeFrame("K7MPQ2", 6)).toBe("K7MPQ2");
    expect(decodeFrame("K7MPQ2", 10)).toBe("K7MPQ2");
  });

  it("tire les lettres non fixées dans l'alphabet des codes (aucun caractère ambigu)", () => {
    const frame = decodeFrame("K7MPQ2", 0);
    for (const char of frame) expect(ROOM_CODE_ALPHABET).toContain(char);
  });

  it("utilise le générateur fourni", () => {
    expect(decodeFrame("AB", 0, () => 0)).toBe(ROOM_CODE_ALPHABET[0].repeat(2));
  });
});
