import { z } from "zod";
import { normalizeRoomCode, validateRoomCode } from "./code";

export const hostRoleSchema = z.enum(["participant", "spectator"]);
export const roomCodeSchema = z.string({ error: "roomCodeInvalid" }).transform(normalizeRoomCode)
  .superRefine((value, ctx) => {
    const error = validateRoomCode(value);
    if (error) ctx.addIssue({ code: "custom", message: error });
  });
/** Segment d'URL `/room/[code]` : décodage sans exception (`%E0%A4%A` → code invalide), puis règles du code. */
export const roomPathCodeSchema = z.string()
  .transform((raw, ctx) => {
    try {
      return decodeURIComponent(raw);
    } catch {
      ctx.addIssue({ code: "custom", message: "roomCodeInvalid" });
      return z.NEVER;
    }
  })
  .pipe(roomCodeSchema);
export const roomWatchSchema = z.object({ code: roomCodeSchema });
