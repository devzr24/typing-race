import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { InviteJoinForm } from "@/app/home-actions";
import { getMessages } from "@/i18n/server";
import { clientIp } from "@/lib/auth/rate-limit";
import { identityFromSession } from "@/lib/rooms/identity";
import { roomStore } from "@/lib/rooms/prisma-store";
import { joinInvite } from "@/lib/rooms/service";
import { publishRoom } from "@/server/realtime";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const [{ token }, session, m] = await Promise.all([params, auth(), getMessages()]);
  const identity = identityFromSession(session);
  const result = identity ? await joinInvite(roomStore, token, identity, clientIp(await headers()))
    : { ok: false as const, error: "loginRequired" as const };
  if (result.ok) {
    await publishRoom(result.code);
    redirect(`/room/${result.code}`);
  }
  return <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">{m.room.invites}</h1>
    <InviteJoinForm token={token} initialState={result} />
  </main>;
}
