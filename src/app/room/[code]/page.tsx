import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { errorText } from "@/i18n/format";
import type { ErrorCode, Messages } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { normalizeRoomCode } from "@/lib/rooms/code";
import { roomStore } from "@/lib/rooms/prisma-store";
import { roomPathCodeSchema } from "@/lib/rooms/schemas";
import { joinRoom, toPublicRoom } from "@/lib/rooms/service";
import { identityFromSession } from "@/lib/rooms/identity";
import { clientIp } from "@/lib/auth/rate-limit";
import { consumeCodeAttempt } from "@/lib/rooms/code-rate-limit";
import { publishRoom } from "@/server/realtime";
import { RoomView } from "./room-view";
import { JoinRoomForm } from "@/app/home-actions";

export async function generateMetadata({ params }: PageProps<"/room/[code]">): Promise<Metadata> {
  const [m, { code }] = await Promise.all([getMessages(), params]);
  return { title: `${m.room.title.replace("{code}", normalizeRoomCode(code))} — ${m.app.name}` };
}

function Notice({ m, title, error }: { m: Messages; title: string; error: ErrorCode }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p role="alert">{errorText(m, error)}</p>
      <Link href="/" className="underline">
        {m.room.backHome}
      </Link>
    </>
  );
}

export default async function RoomPage({ params }: PageProps<"/room/[code]">) {
  const [m, { code: rawCode }] = await Promise.all([getMessages(), params]);
  const session = await auth();
  const parsed = roomPathCodeSchema.safeParse(rawCode);
  const membership = session?.user ? await roomStore.findMembership(session.user.id) : null;
  // Un membre peut recharger sa salle sans consommer de tentative par code.
  const allowed = (parsed.success && membership === parsed.data) || consumeCodeAttempt(clientIp(await headers()));

  let content;
  if (!allowed) {
    content = <Notice m={m} title={m.room.notJoinedTitle} error="tooManyAttempts" />;
  } else if (!parsed.success) {
    content = <Notice m={m} title={m.room.notFoundTitle} error="roomCodeInvalid" />;
  } else if (!session?.user) {
    content = <Notice m={m} title={m.room.loginRequiredTitle} error="loginRequiredForRoom" />;
  } else {
    const result = membership === parsed.data ? { ok: true as const, code: parsed.data }
      : await joinRoom(roomStore, parsed.data, identityFromSession(session)!);
    const room = result.ok ? await roomStore.findRoom(parsed.data) : null;
    const self = room?.participants.find((p) => p.key === session.user.id);
    if (!result.ok) {
      content = <JoinRoomForm code={parsed.data} initialState={result} />;
    } else if (!room) {
      content = <Notice m={m} title={m.room.notFoundTitle} error="roomNotFound" />;
    } else if (!self) {
      content = <Notice m={m} title={m.room.notJoinedTitle} error="notInRoom" />;
    } else {
      if (membership !== parsed.data) await publishRoom(parsed.data);
      content = <RoomView initialRoom={toPublicRoom(room)} selfId={self.id} />;
    }
  }

  return <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">{content}</main>;
}
