import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AVATAR_MAX_BYTES, resizeAvatar, validateAvatar } from "./image";

describe("photos de profil", () => {
  it.each([
    [0xff, 0xd8, 0xff],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    [...Buffer.from("RIFF....WEBP")],
  ])("reconnaît les octets magiques %j", (...signature) => {
    expect(validateAvatar(new Uint8Array(signature))).toBeNull();
  });

  it("refuse un faux PNG renommé et un SVG", async () => {
    const fake = new File(["pas une image"], "photo.png", { type: "image/png" });
    expect(validateAvatar(new Uint8Array(await fake.arrayBuffer()))).toBe("avatarType");
    expect(validateAvatar(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("avatarType");
  });

  it("refuse les fichiers vides et ceux dépassant 2 Mio", () => {
    expect(validateAvatar(new Uint8Array())).toBe("avatarUnreadable");
    const bytes = new Uint8Array(AVATAR_MAX_BYTES + 1);
    bytes.set([0xff, 0xd8, 0xff]);
    expect(validateAvatar(bytes)).toBe("avatarTooLarge");
    expect(validateAvatar(bytes.subarray(0, AVATAR_MAX_BYTES))).toBeNull();
  });

  it("refuse une signature valide dont le décodage échoue", async () => {
    expect(await resizeAvatar(Buffer.from([0xff, 0xd8, 0xff]))).toEqual({ error: "avatarUnreadable" });
  });

  it("produit un WebP carré 256 × 256 sans métadonnées", async () => {
    const input = await sharp({ create: { width: 12, height: 8, channels: 3, background: "red" } })
      .withMetadata({ orientation: 6 }).png().toBuffer();
    const result = await resizeAvatar(input);
    expect(result.error).toBeUndefined();
    const metadata = await sharp(result.bytes!).metadata();
    expect(metadata).toMatchObject({ width: 256, height: 256, format: "webp" });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });
});
