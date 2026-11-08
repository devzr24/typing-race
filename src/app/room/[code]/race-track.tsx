"use client";

import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Bot } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import type { BonusGrant } from "@/lib/race/bonus";
import type { RaceSnapshot } from "@/lib/race/engine";
import { mountTrackCanvas } from "./track-canvas";

export type TrackBonus = { id: number; grant: BonusGrant };
type Racer = RaceSnapshot["racers"][number];

export function createRaceStore() {
  let snapshot: RaceSnapshot | null = null;
  let viewSnapshot: RaceSnapshot | null = null;
  const subscribers = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    getViewSnapshot: () => viewSnapshot,
    subscribe: (subscriber: () => void) => {
      subscribers.add(subscriber);
      return () => { subscribers.delete(subscriber); };
    },
    setSnapshot: (next: RaceSnapshot | null) => {
      snapshot = next;
      const previousRacers = viewSnapshot?.racers;
      // React ne suit que l'identité et le statut ; les valeurs en course sont échantillonnées.
      if (!next || !previousRacers || next.racers.length !== previousRacers.length
        || next.racers.some((racer, index) => {
          const previous = previousRacers[index];
          return racer.id !== previous.id || racer.name !== previous.name || racer.image !== previous.image
            || racer.isBot !== previous.isBot || racer.status !== previous.status
            || (racer.status !== "racing" && (racer.progress !== previous.progress || racer.mpm !== previous.mpm));
        })) viewSnapshot = next;
      for (const subscriber of subscribers) subscriber();
    },
  };
}

type RaceStore = ReturnType<typeof createRaceStore>;

export const RaceTrack = memo(function RaceTrack({ store, racers: results, selfId, bonuses }: { store: RaceStore; racers?: Racer[]; selfId: string; bonuses: TrackBonus[] }) {
  const { m } = useI18n();
  const snapshot = useSyncExternalStore(store.subscribe, store.getViewSnapshot, store.getViewSnapshot);
  const racers = results ?? snapshot?.racers ?? [];
  const racerIds = JSON.stringify(racers.map((racer) => racer.id));
  const track = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sample, setSample] = useState(() => new Map((store.getSnapshot()?.racers ?? racers).map((racer) => [racer.id, racer])));
  const bonusesById = useMemo(() => {
    const byId = new Map<string, TrackBonus>();
    for (const bonus of bonuses) {
      byId.set(bonus.grant.playerId, bonus);
      if (bonus.grant.targetId) byId.set(bonus.grant.targetId, bonus);
    }
    return byId;
  }, [bonuses]);
  const running = racers.some((racer) => racer.status === "racing");
  useEffect(() => {
    if (!running) return;
    // Le texte est échantillonné à 2 Hz ; les marqueurs suivent chaque race:state.
    const timer = setInterval(() => setSample(new Map(store.getSnapshot()?.racers.map((racer) => [racer.id, racer]))), 500);
    return () => clearInterval(timer);
  }, [running, store]);
  useEffect(() => {
    if (track.current && canvas.current) return mountTrackCanvas(track.current, canvas.current, store, results);
  }, [store, results, racerIds]);
  return <section aria-label={m.race.track} className="race-track flex min-w-0 flex-col gap-3">
    <h2 className="text-lg font-medium">{m.race.track}</h2>
    <div ref={track} className="relative">
      <ul className="flex flex-col gap-2">
        {racers.map((racer) => {
          const sampled = racer.status === "racing" ? sample.get(racer.id) ?? racer : racer;
          return <RacerRow key={racer.id} racer={{ ...racer, mpm: sampled.mpm, progress: sampled.progress }} isSelf={racer.id === selfId}
            bonus={bonusesById.get(racer.id)} />;
        })}
      </ul>
      <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full text-cyan" />
    </div>
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
    <div data-racer-id={racer.id} className="h-3 rounded bg-steel px-1.5" aria-hidden="true" />
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
