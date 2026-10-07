import { randomInt } from "node:crypto";

/** Pseudo temporaire proposé aux invités qui n'en choisissent pas, ex. « invite-4821 ». */
export function generateGuestName(): string {
  return `invite-${randomInt(1000, 10000)}`;
}
