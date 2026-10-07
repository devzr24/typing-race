import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";
import { normalizeRoomCode, validateRoomCode } from "@/lib/rooms/code";
import { roomStore } from "@/lib/rooms/prisma-store";
import { toPublicRoom } from "@/lib/rooms/service";
import { RoomView } from "./room-view";

export const metadata: Metadata = { title: "Salle — Typing Race" };

export default function RoomPage({ params }: PageProps<"/room/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p>Chargement de la salle…</p>}>
        <RoomContent params={params} />
      </Suspense>
    </main>
  );
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p role="alert">{message}</p>
      <Link href="/" className="underline">
        Retour à l&apos;accueil
      </Link>
    </>
  );
}

async function RoomContent({ params }: { params: PageProps<"/room/[code]">["params"] }) {
  await connection();
  const [{ code: rawCode }, session] = await Promise.all([params, auth()]);
  const code = normalizeRoomCode(decodeURIComponent(rawCode));

  if (validateRoomCode(code)) {
    return <Notice title="Salle introuvable" message="Ce code de salle n'est pas valide." />;
  }
  if (!session?.user) {
    return (
      <Notice
        title="Connexion requise"
        message="Connecte-toi ou continue en invité, puis rejoins la salle avec son code."
      />
    );
  }
  const room = await roomStore.findRoom(code);
  if (!room) {
    return <Notice title="Salle introuvable" message="Aucune salle ne correspond à ce code." />;
  }
  const self = room.participants.find((p) => p.key === session.user.id);
  if (!self) {
    // Pas d'arrivée par simple lien : on rejoint une salle avec son code, depuis l'accueil.
    return (
      <Notice
        title="Salle non rejointe"
        message="Tu ne fais pas partie de cette salle. Rejoins-la avec son code depuis l'accueil."
      />
    );
  }
  return <RoomView initialRoom={toPublicRoom(room)} selfId={self.id} />;
}
