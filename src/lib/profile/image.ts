import sharp from "sharp";
import type { ErrorCode } from "@/i18n/messages";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Signature réelle uniquement : ni l'extension ni le MIME déclarés ne sont utilisés. */
export function validateAvatar(bytes: Uint8Array): ErrorCode | null {
  if (bytes.byteLength > AVATAR_MAX_BYTES) return "avatarTooLarge";
  if (!bytes.byteLength) return "avatarUnreadable";
  const starts = (signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
  if (starts([0xff, 0xd8, 0xff])
    || starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    || (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))) return null;
  return "avatarType";
}

export async function resizeAvatar(bytes: Uint8Array): Promise<
  { bytes: Buffer; error?: never } | { error: ErrorCode; bytes?: never }
> {
  const error = validateAvatar(bytes);
  if (error) return { error };
  try {
    // Limite aussi les dimensions décodées ; sharp supprime les métadonnées par défaut.
    const output = await sharp(bytes, { limitInputPixels: 24_000_000 })
      .rotate().resize(256, 256, { fit: "cover" }).webp().toBuffer();
    return { bytes: output };
  } catch {
    return { error: "avatarUnreadable" };
  }
}
