"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { publishRoom } from "@/server/realtime";
import { normalizeRoomCode } from "./code";
import { identityFromSession } from "./identity";
import { roomStore } from "./prisma-store";
import { createRoom, joinRoom, leaveRoom } from "./service";

export type RoomFormState = {
  error?: string;
  /** Vrai si l'erreur vient de l'absence de session : on propose alors le lien de connexion. */
  needsLogin?: boolean;
  values?: { code?: string };
};

const LOGIN_REQUIRED = "Connecte-toi ou continue en invité pour jouer.";

export async function createRoomAction(): Promise<RoomFormState> {
  const identity = identityFromSession(await auth());
  if (!identity) return { error: LOGIN_REQUIRED, needsLogin: true };
  const code = await createRoom(roomStore, identity);
  redirect(`/room/${code}`);
}

export async function joinRoomAction(_prev: RoomFormState, formData: FormData): Promise<RoomFormState> {
  const rawCode = String(formData.get("code") ?? "");
  const values = { code: rawCode };
  const identity = identityFromSession(await auth());
  if (!identity) return { error: LOGIN_REQUIRED, needsLogin: true, values };

  const result = await joinRoom(roomStore, rawCode, identity);
  if (!result.ok) return { error: result.error, values };
  await publishRoom(result.code);
  redirect(`/room/${result.code}`);
}

export async function leaveRoomAction(formData: FormData): Promise<void> {
  const identity = identityFromSession(await auth());
  const code = normalizeRoomCode(String(formData.get("code") ?? ""));
  if (identity && code) {
    if ((await leaveRoom(roomStore, code, identity.key)) !== "not-in-room") await publishRoom(code);
  }
  redirect("/");
}
