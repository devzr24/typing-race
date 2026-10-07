"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { errorText, format } from "@/i18n/format";
import type { ErrorCode } from "@/i18n/messages";
import { leaveRoomAction } from "@/lib/rooms/actions";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/rooms/events";
import type { PublicParticipant, PublicRoom } from "@/lib/rooms/types";

type ConnectionState = "connecting" | "live" | "reconnecting";

export function RoomView({ initialRoom, selfId }: { initialRoom: PublicRoom; selfId: string }) {
  const { m } = useI18n();
  const [room, setRoom] = useState<PublicRoom | null>(initialRoom);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [error, setError] = useState<ErrorCode | null>(null);
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
      if (update && !update.participants.some((p) => p.id === selfId)) setError("noLongerInRoom");
    });

    return () => {
      socket.disconnect();
    };
  }, [code, selfId]);

  if (error || !room) {
    return (
      <>
        <h1 className="text-2xl font-semibold">{format(m.room.title, { code })}</h1>
        <p role="alert">{errorText(m, error ?? "roomClosed")}</p>
        <Link href="/" className="underline">
          {m.room.backHome}
        </Link>
      </>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="text-sm text-muted">{m.room.codeLabel}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-4xl font-semibold tracking-[0.3em]">{room.code}</p>
          <CopyButton text={room.code} />
        </div>
        <p className="text-sm text-muted">{m.room.shareHint}</p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="participants-title">
        <div className="flex items-baseline justify-between">
          <h2 id="participants-title" className="text-lg font-medium">
            {format(m.room.participants, { count: room.participants.length })}
          </h2>
          <span className="text-sm text-muted" aria-live="polite">
            {m.room[connection]}
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-border rounded border border-border">
          {room.participants.map((p) => (
            <ParticipantRow key={p.id} participant={p} isSelf={p.id === selfId} />
          ))}
        </ul>
      </section>

      <form action={leaveRoomAction}>
        <input type="hidden" name="code" value={room.code} />
        <button type="submit" className={buttonClass}>
          {m.room.leave}
        </button>
      </form>
    </>
  );
}

function ParticipantRow({ participant: p, isSelf }: { participant: PublicParticipant; isSelf: boolean }) {
  const { m } = useI18n();
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <Avatar name={p.displayName} image={p.image} />
      <span className="font-medium break-all">{p.displayName}</span>
      {isSelf ? <span className="text-sm text-muted">{m.room.you}</span> : null}
      {p.isGuest ? <span className="text-sm text-muted">{m.room.guest}</span> : null}
      {p.isHost ? (
        <span className="ml-auto rounded border border-border px-2 py-0.5 text-xs font-medium">
          {m.room.host}
        </span>
      ) : null}
    </li>
  );
}

function CopyButton({ text }: { text: string }) {
  const { m } = useI18n();
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
      {copied ? m.room.copied : m.room.copy}
    </button>
  );
}
