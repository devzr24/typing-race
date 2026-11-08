"use client";

import { useActionState, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { buttonClass, FormError, primaryButtonClass, selectClass } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { errorText, format } from "@/i18n/format";
import { joinRoomAction, type RoomFormState } from "@/lib/rooms/actions";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/rooms/events";
import { isJoinable } from "@/lib/rooms/state-machine";
import type { LobbyRoom } from "@/lib/rooms/types";

export function LobbyView({ initialRooms }: { initialRooms: LobbyRoom[] }) {
  const { locale, m } = useI18n();
  const number = new Intl.NumberFormat(locale);
  const [rooms, setRooms] = useState(initialRooms);
  const [language, setLanguage] = useState("");
  const [complexity, setComplexity] = useState("");
  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
    socket.on("connect", () => socket.emit("lobby:watch", setRooms));
    socket.on("lobby:update", setRooms);
    return () => { socket.disconnect(); };
  }, []);
  const filtered = rooms.filter((r) => (!language || r.textLanguage === language) && (!complexity || r.complexity === complexity));
  return <>
    <div className="flex flex-wrap gap-3">
      <label>{m.room.configLabels.textLanguage}
        <select className={selectClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="">{m.lobby.all}</option>
          {(["FR", "EN"] as const).map((v) => <option key={v} value={v}>{m.room.configOptions[v]}</option>)}
        </select>
      </label>
      <label>{m.room.configLabels.complexity}
        <select className={selectClass} value={complexity} onChange={(e) => setComplexity(e.target.value)}>
          <option value="">{m.lobby.all}</option>
          {(["FACILE", "MOYEN", "DIFFICILE"] as const).map((v) => <option key={v} value={v}>{m.room.configOptions[v]}</option>)}
        </select>
      </label>
    </div>
    <ul className="flex flex-col gap-3" aria-live="polite">
      {filtered.map((room) => <li key={room.code} className="flex flex-col gap-2 rounded border border-line bg-card p-4">
        <h2 className="font-mono">{room.code}</h2>
        <p>{format(m.lobby.places, { count: number.format(room.count), capacity: number.format(room.capacity) })}</p>
        <p>{m.room.configOptions[room.textLanguage]} · {m.room.configOptions[room.complexity]}</p>
        <p>{format(m.lobby.host, { name: room.hostName })}</p>
        <p>{m.lobby.states[room.status]}</p>
        {isJoinable(room) ? <LobbyJoin room={room} /> : null}
      </li>)}
    </ul>
    {!filtered.length ? <p>{m.lobby.empty}</p> : null}
  </>;
}

function LobbyJoin({ room }: { room: LobbyRoom }) {
  const { m } = useI18n();
  const [state, action, pending] = useActionState(joinRoomAction, {} as RoomFormState);
  return <form action={action} className="flex flex-col gap-2">
    <input type="hidden" name="code" value={room.code} />
    <FormError message={state.error && errorText(m, state.error)} />
    {state.currentCode ? <button className={buttonClass} name="leaveCurrent" value="true" disabled={pending}>
      {format(m.home.leaveAndJoin, { code: state.currentCode })}
    </button> : null}
    <label><input name="spectator" value="true" type="checkbox" defaultChecked={room.count >= room.capacity} />{m.room.joinSpectator}</label>
    <button className={primaryButtonClass} disabled={pending}>{m.home.join}</button>
  </form>;
}
