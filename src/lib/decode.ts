import { ROOM_CODE_ALPHABET } from "@/lib/rooms/code";

/**
 * Une image de l'effet « décodage » : les `settled` premières lettres sont définitives,
 * les suivantes sont tirées au hasard dans l'alphabet des codes.
 */
export function decodeFrame(
  target: string,
  settled: number,
  random: () => number = Math.random,
): string {
  let frame = target.slice(0, Math.max(0, settled));
  for (let i = frame.length; i < target.length; i++) {
    frame += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return frame;
}
