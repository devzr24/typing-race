"use client";

import { useEffect, useState } from "react";
import { buttonClass, inputClass, selectClass } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { errorText } from "@/i18n/format";
import { raceConfigSchema, roomAccessSchema, type HostCommand } from "@/lib/rooms/schemas";
import type { PublicRoom, RoomBot } from "@/lib/rooms/types";

export function RoomConfiguration({ room, editable, command }: {
  room: PublicRoom; editable: boolean; command: (command: HostCommand) => void;
}) {
  const { m } = useI18n();
  const [invalid, setInvalid] = useState(false);
  const [invalidAccess, setInvalidAccess] = useState(false);
  const c = room.config;
  const selects = {
    textLanguage: ["FR", "EN"], textType: ["COHERENT", "ALEATOIRE"],
    complexity: ["FACILE", "MOYEN", "DIFFICILE"], errorMode: ["CORRECTION", "LIBRE"],
  } as const;
  return <section className="flex flex-col gap-3" aria-labelledby="config-title">
    <h2 id="config-title" className="text-lg font-medium">{m.room.configuration}</h2>
    <form onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const parsed = roomAccessSchema.safeParse({ visibility: data.get("visibility"), capacity: Number(data.get("capacity")) });
      setInvalidAccess(!parsed.success);
      if (parsed.success) command({ type: "configureAccess", access: parsed.data });
    }}>
      <fieldset disabled={!editable} className="grid gap-3 disabled:opacity-70">
        <legend>{m.room.access}</legend>
        <label className="flex flex-col gap-1">{m.room.visibility}
          <select className={selectClass} name="visibility" defaultValue={room.visibility}>
            {(["PUBLIQUE", "SUR_CODE", "PRIVEE"] as const).map((v) => <option key={v} value={v}>{m.room.visibilities[v]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">{m.room.capacity}
          <input className={inputClass} name="capacity" type="number" min={2} max={30} required defaultValue={room.capacity} />
        </label>
        <button className={buttonClass}>{m.room.saveAccess}</button>
      </fieldset>
      {invalidAccess ? <p role="alert" className="text-alert">{errorText(m, "roomConfigInvalid")}</p> : null}
    </form>
    <form onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const parsed = raceConfigSchema.safeParse({
        ...Object.fromEntries(data),
        timeLimitSec: data.get("timeLimitSec") === "" ? null : Number(data.get("timeLimitSec")),
        wordCount: Number(data.get("wordCount")),
        ...Object.fromEntries((["punctuation", "numbers", "capitals", "accents", "bonusesEnabled"] as const).map((key) => [key, data.has(key)])),
      });
      setInvalid(!parsed.success);
      if (parsed.success) command({ type: "configure", config: parsed.data });
    }}>
      <fieldset disabled={!editable} className="grid gap-3 disabled:opacity-70">
        {Object.entries(selects).map(([key, options]) => {
          const name = key as keyof typeof selects;
          return <label key={name} className="flex flex-col gap-1">
            {m.room.configLabels[name]}
            <select name={name} defaultValue={c[name]} className={selectClass}>
              {options.map((value) => <option key={value} value={value}>{m.room.configOptions[value]}</option>)}
            </select>
          </label>;
        })}
        <label className="flex flex-col gap-1">{m.room.configLabels.timeLimitSec}
          <input className={inputClass} name="timeLimitSec" type="number" min={30} max={600} defaultValue={c.timeLimitSec ?? ""} />
          <span className="text-sm text-mist">{m.room.noTimeLimit}</span>
        </label>
        <label className="flex flex-col gap-1">{m.room.configLabels.wordCount}
          <input className={inputClass} name="wordCount" type="number" min={10} max={200} required defaultValue={c.wordCount} />
        </label>
        {(["includeChars", "excludeChars"] as const).map((name) => <label key={name} className="flex flex-col gap-1">
          {m.room.configLabels[name]}<input className={inputClass} name={name} maxLength={40} defaultValue={c[name]} />
        </label>)}
        {(["punctuation", "numbers", "capitals", "accents", "bonusesEnabled"] as const).map((name) => <label key={name} className="flex items-center gap-2">
          <input name={name} type="checkbox" defaultChecked={c[name]} />{m.room.configLabels[name]}
        </label>)}
        <button className={buttonClass} type="submit">{m.room.saveConfig}</button>
      </fieldset>
      {invalid ? <p role="alert" className="text-alert">{errorText(m, "roomConfigInvalid")}</p> : null}
    </form>
    <form onSubmit={(event) => {
      event.preventDefault();
      const level = new FormData(event.currentTarget).get("level") as RoomBot["level"];
      command({ type: "addBot", level });
    }}>
      <fieldset disabled={!editable} className="flex flex-wrap items-center gap-2 disabled:opacity-70">
        <label className="flex items-center gap-2">{m.room.botLevel}
          <select name="level" className={selectClass} defaultValue="BEGINNER">
            {(Object.keys(m.room.botLevels) as RoomBot["level"][]).map((level) => <option key={level} value={level}>{m.room.botLevels[level]}</option>)}
          </select>
        </label>
        <button type="submit" className={buttonClass}>{m.room.addBot}</button>
      </fieldset>
    </form>
  </section>;
}

export function RaceCountdown({ startsAt, serverNow }: { startsAt: number; serverNow: number }) {
  const { locale, m } = useI18n();
  const [remaining, setRemaining] = useState(() => Math.max(1, Math.ceil((startsAt - serverNow) / 1000)));
  useEffect(() => {
    const offset = serverNow - Date.now();
    const timer = setInterval(() => setRemaining(Math.max(1, Math.ceil((startsAt - Date.now() - offset) / 1000))), 100);
    return () => clearInterval(timer);
  }, [startsAt, serverNow]);
  return <p role="status" aria-label={m.room.countdown} className="font-mono text-4xl text-cyan">{new Intl.NumberFormat(locale).format(remaining)}</p>;
}
