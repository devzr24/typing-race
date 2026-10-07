"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { buttonClass } from "@/components/form-field";
import { leaveRoomAction } from "@/lib/rooms/actions";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/rooms/events";
import type { PublicParticipant, PublicRoom } from "@/lib/rooms/types";

type ConnectionState = "connecting" | "live" | "reconnecting";

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: "Connexion…",
  live: "En direct",
  reconnecting: "Reconnexion…",
};

export function RoomView({ initialRoom, selfId }: { initialRoom: PublicRoom; selfId: string }) {
  const [room, setRoom] = useState<PublicRoom | null>(initialRoom);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const code = initialRoom.code;

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

    // À chaque (re)connexion, on se réabonne à la salle : la place est conservée côté serveur.
    socket.on("connect", () => {
      socket.emit("room:watch", { code }, (response) => {
        if (response.ok) {
          setRoom(response.room);
          setError(null);
          setConnection("live");
        } else {
          setError(response.error);
        }
      });
    });
    socket.on("disconnect", () => setConnection("reconnecting"));
    socket.on("connect_error", () => setConnection("reconnecting"));
    socket.on("room:update", (update) => {
      setRoom(update);
      if (update && !update.participants.some((p) => p.id === selfId)) {
        setError("Tu ne fais plus partie de cette salle.");
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [code, selfId]);

  if (error || !room) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Salle {code}</h1>
        <p role="alert">{error ?? "Cette salle a été fermée."}</p>
        <Link href="/" className="underline">
          Retour à l&apos;accueil
        </Link>
      </>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="text-sm text-zinc-500">Code de la salle</h1>
        <div className="flex items-center gap-3">
          <p className="font-mono text-4xl font-semibold tracking-[0.3em]">{room.code}</p>
          <CopyButton text={room.code} />
        </div>
        <p className="text-sm text-zinc-500">
          Donne ce code aux autres joueurs : ils le saisissent sur la page d&apos;accueil.
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="participants-title">
        <div className="flex items-baseline justify-between">
          <h2 id="participants-title" className="text-lg font-medium">
            Participants ({room.participants.length})
          </h2>
          <span className="text-sm text-zinc-500" aria-live="polite">
            {CONNECTION_LABELS[connection]}
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {room.participants.map((p) => (
            <ParticipantRow key={p.id} participant={p} isSelf={p.id === selfId} />
          ))}
        </ul>
      </section>

      <form action={leaveRoomAction}>
        <input type="hidden" name="code" value={room.code} />
        <button type="submit" className={buttonClass}>
          Quitter la salle
        </button>
      </form>
    </>
  );
}

function ParticipantRow({ participant: p, isSelf }: { participant: PublicParticipant; isSelf: boolean }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      {p.image ? (
        <Image src={p.image} alt="" width={32} height={32} className="rounded-full" />
      ) : (
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium uppercase dark:bg-zinc-800"
        >
          {p.displayName.charAt(0)}
        </span>
      )}
      <span className="font-medium">{p.displayName}</span>
      {isSelf ? <span className="text-sm text-zinc-500">(toi)</span> : null}
      {p.isGuest ? <span className="text-sm text-zinc-500">(invité)</span> : null}
      {p.isHost ? (
        <span className="ml-auto rounded border border-zinc-400 px-2 py-0.5 text-xs font-medium">
          hôte
        </span>
      ) : null}
    </li>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copié !" : "Copier"}
    </button>
  );
}
