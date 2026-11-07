"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { io, type Socket } from "socket.io-client";
import { Avatar } from "@/components/avatar";
import { useFeedback } from "@/components/effects";
import { DecodedCode, useEffectsEnabled } from "@/components/motion-effects";
import { buttonClass, primaryButtonClass } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { errorText, format } from "@/i18n/format";
import type { ErrorCode } from "@/i18n/messages";
import { leaveRoomAction } from "@/lib/rooms/actions";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/rooms/events";
import type { PublicParticipant, PublicRoom } from "@/lib/rooms/types";
import type { HostCommand } from "@/lib/rooms/schemas";
import { launchError } from "@/lib/rooms/state-machine";
import { RaceCountdown, RoomConfiguration } from "./room-configuration";

type ConnectionState = "connecting" | "live" | "reconnecting";

export function RoomView({ initialRoom, selfId }: { initialRoom: PublicRoom; selfId: string }) {
  const { m } = useI18n();
  const [room, setRoom] = useState<PublicRoom | null>(initialRoom);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [error, setError] = useState<ErrorCode | null>(null);
  const [actionError, setActionError] = useState<ErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const code = initialRoom.code;
  const { play } = useFeedback();
  const participantCount = useRef(initialRoom.participants.length);

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
    socketRef.current = socket;

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
      // Son discret quand un joueur arrive (si le son est activé).
      const count = update?.participants.length ?? 0;
      if (count > participantCount.current) play("join");
      participantCount.current = count;
      setRoom(update);
      if (update && !update.participants.some((p) => p.id === selfId)) setError("noLongerInRoom");
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [code, selfId, play]);

  function command(command: HostCommand) {
    const socket = socketRef.current;
    if (!socket?.connected) return setActionError("serverError");
    setPending(true);
    setActionError(null);
    socket.timeout(10000).emit("room:command", { code, command }, (error, response) => {
      setPending(false);
      if (error || !response) setActionError("serverError");
      else if (!response.ok) setActionError(response.error);
    });
  }

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

  const isHost = room.participants.some((p) => p.id === selfId && p.isHost);
  const canConfigure = room.status === "EN_ATTENTE" || room.status === "RESULTATS";
  const startError = launchError(room);

  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="text-sm text-mist">{m.room.codeLabel}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <DecodedCode code={room.code} className="font-mono text-4xl font-semibold tracking-[0.3em]" />
          <CopyButton text={room.code} />
        </div>
        <p className="text-sm text-mist">{m.room.shareHint}</p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="participants-title">
        <div className="flex items-baseline justify-between">
          <h2 id="participants-title" className="text-lg font-medium">
            {format(m.room.participants, { count: room.participants.length })}
          </h2>
          <span className="text-sm text-mist" aria-live="polite">
            {m.room[connection]}
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {/* initial={false} : pas d'animation pour les joueurs déjà présents à l'ouverture. */}
          <AnimatePresence initial={false}>
            {room.participants.map((p) => (
              <ParticipantRow key={p.id} participant={p} isSelf={p.id === selfId} />
            ))}
          </AnimatePresence>
        </ul>
      </section>

      {actionError ? <p role="alert" className="text-alert">{errorText(m, actionError)}</p> : null}
      <RoomConfiguration key={JSON.stringify(room.config)} room={room} editable={isHost && canConfigure && !pending && connection === "live"} command={command} />
      <ul className="flex flex-col gap-2">
        {room.bots.map((bot) => (
          <li key={bot.id} className="flex items-center gap-3 rounded border border-line bg-card px-3 py-2">
            <span>{bot.name}</span>
            <span className="rounded border border-cyan px-2 text-sm text-cyan">{m.room.bot}</span>
            <span>{m.room.botLevels[bot.level]}</span>
            {isHost && canConfigure ? <button className={buttonClass} disabled={pending || connection !== "live"} onClick={() => command({ type: "removeBot", id: bot.id })}>{m.room.removeBot}</button> : null}
          </li>
        ))}
      </ul>
      {room.status === "DECOMPTE" && room.race ? <RaceCountdown key={room.race.startsAt} startsAt={room.race.startsAt} serverNow={room.serverNow} /> : null}
      {room.status === "EN_COURSE" && room.race ? <section aria-label={m.room.raceText} className="whitespace-pre-wrap rounded border border-line bg-card p-4">{room.race.text}</section> : null}
      {room.status === "RESULTATS" ? <h2 className="text-lg font-medium">{m.room.results}</h2> : null}
      {isHost ? <div className="flex flex-wrap gap-3">
        {room.status === "EN_ATTENTE" ? <div className="flex flex-col gap-1">
          <button className={primaryButtonClass} disabled={!!startError || pending || connection !== "live"} aria-describedby={startError ? "start-reason" : undefined} onClick={() => command({ type: "start" })}>{m.room.start}</button>
          {startError ? <p id="start-reason" className="text-sm text-mist">{errorText(m, startError)}</p> : null}
        </div> : null}
        {room.status === "RESULTATS" ? <button className={primaryButtonClass} disabled={pending || connection !== "live"} onClick={() => command({ type: "reset" })}>{m.room.newRace}</button> : null}
        <button className={buttonClass} disabled={pending || connection !== "live"} onClick={() => command({ type: "close" })}>{m.room.close}</button>
      </div> : null}

      <form action={leaveRoomAction}>
        <input type="hidden" name="code" value={room.code} />
        <button type="submit" className={buttonClass}>
          {m.room.leave}
        </button>
      </form>
    </>
  );
}

const NEON_GLOW = "0 0 18px color-mix(in srgb, var(--color-neon) 60%, transparent)";
const NO_GLOW = "0 0 0px color-mix(in srgb, var(--color-neon) 0%, transparent)";

function ParticipantRow({ participant: p, isSelf }: { participant: PublicParticipant; isSelf: boolean }) {
  const { m } = useI18n();
  const animated = useEffectsEnabled();
  // Chaque joueur dans une carte ; l'hôte est mis en valeur par une bordure neon.
  return (
    <motion.li
      layout={animated}
      initial={animated ? { opacity: 0, x: -24, boxShadow: NEON_GLOW } : false}
      animate={{ opacity: 1, x: 0, boxShadow: NO_GLOW }}
      exit={animated ? { opacity: 0, transition: { duration: 0.3 } } : { opacity: 0, transition: { duration: 0 } }}
      transition={{ duration: 0.45, ease: "easeOut", boxShadow: { duration: 1.2 } }}
      className={`flex items-center gap-3 rounded-lg border-2 bg-card px-3 py-2 ${p.isHost ? "border-neon" : "border-line"}`}
    >
      <Avatar name={p.displayName} image={p.image} />
      <span className="font-medium break-all">{p.displayName}</span>
      {isSelf ? <span className="text-sm text-ink/70">{m.room.you}</span> : null}
      {p.isGuest ? <span className="text-sm text-ink/70">{m.room.guest}</span> : null}
      {p.isSpectator ? <span className="text-sm text-ink/70">{m.room.spectator}</span> : null}
      {p.isHost ? (
        <span className="ml-auto rounded border border-neon bg-neon px-2 py-0.5 text-xs font-semibold text-night">
          {m.room.host}
        </span>
      ) : null}
    </motion.li>
  );
}

function CopyButton({ text }: { text: string }) {
  const { m } = useI18n();
  const [copied, setCopied] = useState(false);
  const Icon = copied ? Check : Copy;
  return (
    <>
      <button
        type="button"
        className="icon-frame"
        aria-label={m.room.copy}
        title={m.room.copy}
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
        <Icon size={18} aria-hidden="true" />
      </button>
      {/* Annonce « Copié ! » aux lecteurs d'écran, et affichée à côté de l'icône. */}
      <span className="text-sm text-ink" aria-live="polite">
        {copied ? m.room.copied : ""}
      </span>
    </>
  );
}
