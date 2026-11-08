"use client";

import { memo, useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useI18n } from "@/i18n/client";
import type { BonusGrant } from "@/lib/race/bonus";
import type { RaceSnapshot } from "@/lib/race/engine";

export type TrackBonus = { id: number; grant: BonusGrant };
type Racer = RaceSnapshot["racers"][number];

export function RaceTrack({ racers, selfId, bonuses }: { racers: Racer[]; selfId: string; bonuses: TrackBonus[] }) {
  const { m } = useI18n();
  return <section aria-label={m.race.track} className="flex flex-col gap-3">
    <h2 className="text-lg font-medium">{m.race.track}</h2>
    <ul className="flex flex-col gap-2">
      {racers.map((racer) => <RacerRow key={racer.id} racer={racer} isSelf={racer.id === selfId}
        bonus={bonuses.findLast((b) => b.grant.playerId === racer.id || b.grant.targetId === racer.id)} />)}
    </ul>
  </section>;
}

const RacerRow = memo(function RacerRow({ racer, isSelf, bonus }: { racer: Racer; isSelf: boolean; bonus?: TrackBonus }) {
  const { locale, m } = useI18n();
  const percent = Math.max(0, Math.min(1, racer.progress));
  return <li className={`flex flex-col gap-2 rounded border bg-card p-3 ${isSelf ? "border-neon" : "border-line"}`}>
    <div className="flex flex-wrap items-center gap-2">
      <Avatar name={racer.name} image={racer.image} />
      <span className="break-all font-medium">{racer.name}</span>
      {isSelf ? <span className="text-sm text-mist">{m.race.you}</span> : null}
      {racer.isBot ? <span className="flex items-center gap-1 text-sm text-mist"><Bot size={16} aria-hidden="true" />{m.room.bot}</span> : null}
      <span>{new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(percent)}</span>
      <span>{new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(racer.mpm)} {m.race.mpm}</span>
      <span>{m.race.statuses[racer.status]}</span>
      {bonus ? <BonusBadge key={bonus.id} grant={bonus.grant} /> : null}
    </div>
    <div className="overflow-hidden rounded bg-steel px-1.5" aria-hidden="true">
      <div className="race-marker w-full" style={{ transform: `translateX(${percent * 100}%)` }}>
        <span className="block size-3 -translate-x-1/2 rounded-full bg-cyan" />
      </div>
    </div>
  </li>;
}, (previous, next) => previous.isSelf === next.isSelf && previous.bonus === next.bonus
  && previous.racer.name === next.racer.name && previous.racer.image === next.racer.image
  && previous.racer.isBot === next.racer.isBot && previous.racer.progress === next.racer.progress
  && previous.racer.mpm === next.racer.mpm && previous.racer.status === next.racer.status);

function BonusBadge({ grant }: { grant: BonusGrant }) {
  const { m } = useI18n();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);
  return visible ? <span className="rounded border border-cyan px-2 text-sm text-cyan">{m.race.bonuses[grant.type]}</span> : null;
}
