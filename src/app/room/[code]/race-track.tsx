"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Bot } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import type { BonusGrant } from "@/lib/race/bonus";
import type { RaceSnapshot } from "@/lib/race/engine";

export type TrackBonus = { id: number; grant: BonusGrant };
type Racer = RaceSnapshot["racers"][number];

export const RaceTrack = memo(function RaceTrack({ racers, selfId, bonuses }: { racers: Racer[]; selfId: string; bonuses: TrackBonus[] }) {
  const { m } = useI18n();
  const latestRacers = useRef(racers);
  const [speedSample, setSpeedSample] = useState(racers);
  const running = racers.some((racer) => racer.status === "racing");
  useEffect(() => { latestRacers.current = racers; }, [racers]);
  useEffect(() => {
    if (!running) return;
    // Seule la vitesse est échantillonnée ; la position suit chaque race:state.
    const timer = setInterval(() => setSpeedSample(latestRacers.current), 500);
    return () => clearInterval(timer);
  }, [running]);
  return <section aria-label={m.race.track} className="race-track flex min-w-0 flex-col gap-3">
    <h2 className="text-lg font-medium">{m.race.track}</h2>
    <ul className="flex flex-col gap-2">
      {racers.map((racer) => <RacerRow key={racer.id} racer={{ ...racer, mpm: racer.status === "racing" ? speedSample.find((sample) => sample.id === racer.id)?.mpm ?? racer.mpm : racer.mpm }} isSelf={racer.id === selfId}
        bonus={bonuses.findLast((b) => b.grant.playerId === racer.id || b.grant.targetId === racer.id)} />)}
    </ul>
  </section>;
});

const RacerRow = memo(function RacerRow({ racer, isSelf, bonus }: { racer: Racer; isSelf: boolean; bonus?: TrackBonus }) {
  const { locale, m } = useI18n();
  const percentFormat = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }), [locale]);
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const percent = Math.max(0, Math.min(1, racer.progress));
  return <li className={`race-row flex min-w-0 flex-col gap-2 rounded border bg-card p-3 ${isSelf ? "border-neon" : "border-line"}`}>
    <div className="race-row-details grid items-center gap-2 tabular-nums">
      <div className="race-identity flex min-w-0 items-center gap-2">
        <Avatar name={racer.name} image={racer.image} />
        <span className="truncate font-medium" title={racer.name}>{racer.name}</span>
        {isSelf ? <span className="shrink-0 text-sm text-mist">{m.race.you}</span> : null}
        {racer.isBot ? <span className="flex shrink-0 items-center gap-1 text-sm text-mist"><Bot size={16} aria-hidden="true" />{m.room.bot}</span> : null}
      </div>
      <span className="whitespace-nowrap">{percentFormat.format(percent)}</span>
      <span className="whitespace-nowrap">{number.format(racer.mpm)} {m.race.mpm}</span>
      <span className="race-status whitespace-nowrap">{m.race.statuses[racer.status]}</span>
      {bonus ? <BonusBadge key={bonus.id} grant={bonus.grant} triggered={bonus.grant.playerId === racer.id && bonus.grant.targetId !== racer.id} /> : null}
    </div>
    <div className="overflow-hidden rounded bg-steel px-1.5" aria-hidden="true">
      <div className="race-marker w-full" data-running={racer.status === "racing"} style={{ transform: `translateX(${percent * 100}%)` }}>
        <span className="block size-3 -translate-x-1/2 rounded-full bg-cyan" />
      </div>
    </div>
  </li>;
}, (previous, next) => previous.isSelf === next.isSelf && previous.bonus === next.bonus
  && previous.racer.name === next.racer.name && previous.racer.image === next.racer.image
  && previous.racer.isBot === next.racer.isBot && previous.racer.progress === next.racer.progress
  && Math.round(previous.racer.mpm) === Math.round(next.racer.mpm) && previous.racer.status === next.racer.status);

function BonusBadge({ grant, triggered }: { grant: BonusGrant; triggered: boolean }) {
  const { m } = useI18n();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);
  return visible ? <span className="col-span-full rounded border border-cyan px-2 text-sm text-cyan">{triggered ? format(m.race.triggeredBonus, { bonus: m.race.bonuses[grant.type] }) : m.race.bonuses[grant.type]}</span> : null;
}
