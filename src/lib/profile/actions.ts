"use server";

import { auth, unstable_update } from "@/auth";
import type { ErrorCode } from "@/i18n/messages";
import { authRateLimiter } from "@/lib/auth/rate-limit";
import { guestSchema } from "@/lib/auth/schemas";
import { prisma } from "@/lib/prisma";
import { publishRoom } from "@/server/realtime";
import { AVATAR_MAX_BYTES, resizeAvatar } from "./image";

export type ProfileFormState = { error?: ErrorCode; saved?: boolean };

async function refreshProfile(userId: string) {
  await unstable_update({});
  const membership = await prisma.roomParticipant.findUnique({
    where: { key: userId }, select: { room: { select: { code: true } } },
  });
  if (membership) await publishRoom(membership.room.code);
}

export async function updateDisplayName(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user.id || session.user.isGuest) return { error: "profileAccountRequired" };
  const parsed = guestSchema.safeParse({ pseudo: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message as ErrorCode };
  const name = parsed.data.pseudo;
  const taken = await prisma.user.findFirst({
    where: { username: { equals: name, mode: "insensitive" }, id: { not: session.user.id } },
    select: { id: true },
  });
  if (taken) return { error: "displayNameTaken" };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, roomEntries: { updateMany: { where: {}, data: { displayName: name } } } },
  });
  await refreshProfile(session.user.id);
  return { saved: true };
}

export async function uploadAvatar(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user.id || session.user.isGuest) return { error: "profileAccountRequired" };
  if (!authRateLimiter.consume(`avatar:user:${session.user.id}`, 10, 60 * 60_000)) {
    return { error: "tooManyAttempts" };
  }
  const file = formData.get("avatar");
  if (!(file instanceof File)) return { error: "avatarUnreadable" };
  // Avant arrayBuffer() pour ne pas copier intégralement un fichier refusé.
  if (file.size > AVATAR_MAX_BYTES) return { error: "avatarTooLarge" };
  const result = await resizeAvatar(new Uint8Array(await file.arrayBuffer()));
  if (result.error) return { error: result.error };
  await prisma.$transaction(async (tx) => {
    const data = { bytes: new Uint8Array(result.bytes), mime: "image/webp" };
    const avatar = await tx.userAvatar.upsert({
      where: { userId: session.user.id }, create: { userId: session.user.id, ...data }, update: data,
    });
    const image = `/api/avatars/${encodeURIComponent(session.user.id)}?v=${avatar.updatedAt.getTime()}`;
    await tx.user.update({
      where: { id: session.user.id },
      data: { image, roomEntries: { updateMany: { where: {}, data: { image } } } },
    });
  });
  await refreshProfile(session.user.id);
  return { saved: true };
}
