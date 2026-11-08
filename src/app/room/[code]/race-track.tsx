"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Bot } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import type { BonusGrant } from "@/lib/race/bonus";
import type { RaceSnapshot } from "@/lib/race/engine";

export type TrackBonus = { id: number; grant: BonusGrant };
type Racer = RaceSnapshot["racers"][number];
type Marker = { element: HTMLDivElement; progress: number | null };
type RegisterMarker = (id: string, element: HTMLDivElement | null) => void;

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
  const markers = useRef(new Map<string, Marker>());
  const registerMarker = useCallback<RegisterMarker>((id, element) => {
    if (element) markers.current.set(id, { element, progress: null });
    else markers.current.delete(id);
  }, []);
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
    // Entre deux race:state (10 Hz), un coureur avance d'environ un pixel : pas d'interpolation,
    // une seule écriture groupée par état reçu, dans une seule image.
    let frame: number | null = null;
    const updateMarkers = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        for (const racer of results ?? store.getSnapshot()?.racers ?? []) {
          const marker = markers.current.get(racer.id);
          const target = Math.max(0, Math.min(1, racer.progress));
          if (!marker || marker.progress === target) continue;
          marker.progress = target;
          marker.element.style.transform = `translateX(${target * 100}%)`;
        }
      });
    };
    const unsubscribe = store.subscribe(updateMarkers);
    updateMarkers();
    return () => {
      unsubscribe();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [store, results, snapshot]);
  return <section aria-label={m.race.track} className="race-track flex min-w-0 flex-col gap-3">
    <h2 className="text-lg font-medium">{m.race.track}</h2>
    <ul className="flex flex-col gap-2">
      {racers.map((racer) => {
        const sampled = racer.status === "racing" ? sample.get(racer.id) ?? racer : racer;
        return <RacerRow key={racer.id} racer={{ ...racer, mpm: sampled.mpm, progress: sampled.progress }} isSelf={racer.id === selfId}
          registerMarker={registerMarker} bonus={bonusesById.get(racer.id)} />;
      })}
    </ul>
  </section>;
});

const RacerRow = memo(function RacerRow({ racer, isSelf, bonus, registerMarker }: { racer: Racer; isSelf: boolean; bonus?: TrackBonus; registerMarker: RegisterMarker }) {
  const { locale, m } = useI18n();
  const percentFormat = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }), [locale]);
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const percent = Math.max(0, Math.min(1, racer.progress));
  const markerRef = useCallback((element: HTMLDivElement | null) => registerMarker(racer.id, element), [racer.id, registerMarker]);
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
    <div className="rounded bg-steel px-1.5" aria-hidden="true">
      <div ref={markerRef} className="race-marker w-full" data-running={racer.status === "racing"}>
        <span className="block size-3 -translate-x-1/2 rounded-full bg-cyan" />
      </div>
    </div>
  </li>;
}, (previous, next) => previous.isSelf === next.isSelf && previous.bonus === next.bonus
  && previous.registerMarker === next.registerMarker
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
