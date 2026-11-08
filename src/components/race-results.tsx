"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Avatar } from "@/components/avatar";
import { inputClass } from "@/components/form-field";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/format";
import { chartScales, keyboardMisses, keyboardRows, keyIntensity, type ResultRow } from "@/lib/race/results-visuals";

const strokes = ["", "8 4", "2 4", "12 4 2 4", "5 3 1 3", "14 5"];
const colors = ["text-cyan", "text-neon", "text-alert", "text-ink", "text-mist", "text-steel"];

export function RaceResults({ results, selfId, selectable = false, canOpen = false }: {
  results: ResultRow[]; selfId?: string; selectable?: boolean; canOpen?: boolean;
}) {
  const { locale, m } = useI18n();
  const uid = useId();
  const [selectedId, setSelectedId] = useState(selfId ?? results[0]?.id);
  const selected = results.find((r) => r.id === (selectable ? selectedId : selfId));
  const local = results.find((r) => r.id === selfId);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const seconds = new Intl.NumberFormat(locale, { style: "unit", unit: "second", maximumFractionDigits: 1 });
  const duration = (ms: number | undefined) => ms === undefined ? m.results.unavailable : seconds.format(ms / 1000);
  const scales = chartScales(results);
  const misses = keyboardMisses(selected?.missedKeys ?? {}, locale);
  const maxMisses = Math.max(0, ...Object.values(misses));
  const rows = keyboardRows(locale);
  const knownKeys = new Set([...rows.flat(), " "]);
  const extras = Object.keys(misses).filter((key) => !knownKeys.has(key));

  function keycap(key: string) {
    const label = key === " " ? m.results.space : key;
    const count = misses[key] ?? 0;
    const errors = format(m.results.keyErrors[count === 1 ? "one" : "other"], { count: integer.format(count) });
    return <li key={key} title={`${label}${errors}`} className="relative min-w-7 overflow-hidden rounded border border-line px-1 py-2 text-center font-mono text-sm">
      <span aria-hidden className="absolute inset-0 bg-alert" style={{ opacity: keyIntensity(count, maxMisses) * 0.65 }} />
      <span className="relative">{label}<span className="sr-only">{errors}</span></span>
    </li>;
  }

  return <section className="flex min-w-0 flex-col gap-6" aria-labelledby={`${uid}-title`}>
    <h2 id={`${uid}-title`} className="font-display text-xl">{m.room.results}</h2>
    {local?.isPersonalBest ? <p role="status" className="font-semibold text-neon">{m.results.personalBest}</p> : null}
    {canOpen && local?.raceId ? <Link href={`/races/${local.raceId}`} className="text-cyan underline">{m.results.permalink}</Link> : null}

    <section aria-labelledby={`${uid}-podium`}>
      <h3 id={`${uid}-podium`} className="mb-3 text-lg font-medium">{m.results.podium}</h3>
      <ol className="grid grid-cols-3 gap-2">
        {results.slice(0, 3).map((r) => <li key={r.id} className="flex min-w-0 flex-col items-center gap-2 rounded border border-line bg-card p-3 text-center">
          <span className="font-display text-xl text-cyan">{integer.format(r.rank)}</span>
          <Avatar name={r.name} image={r.image} />
          <span className="break-all">{r.name}</span>
          {r.isBot ? <span className="text-sm text-mist">{m.room.bot}</span> : null}
          <span>{number.format(r.netMpm)} {m.race.mpm}</span>
        </li>)}
      </ol>
    </section>

    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="mb-3 text-left text-lg font-medium">{m.results.table}</caption>
        <thead><tr>{[m.results.rank, m.results.participant, m.race.netMpm, m.results.rawMpm, m.race.accuracy, m.results.errors, m.results.time, m.results.status, m.results.bonuses].map((label) => <th key={label} scope="col" className="border-b border-line px-2 py-3 whitespace-nowrap">{label}</th>)}</tr></thead>
        <tbody>{results.map((r) => <tr key={r.id}>
          <td className="border-b border-line p-2">{integer.format(r.rank)}</td>
          <th scope="row" className="border-b border-line p-2 font-medium">{r.name}{r.isBot ? ` (${m.room.bot})` : ""}</th>
          <td className="border-b border-line p-2">{number.format(r.netMpm)}</td>
          <td className="border-b border-line p-2">{number.format(r.grossMpm)}</td>
          <td className="border-b border-line p-2">{percent.format(r.accuracy / 100)}</td>
          <td className="border-b border-line p-2">{integer.format(r.errors)}</td>
          <td className="border-b border-line p-2 whitespace-nowrap">{duration(r.elapsedMs)}</td>
          <td className="border-b border-line p-2">{m.results.outcomes[r.status]}</td>
          <td className="border-b border-line p-2">{r.bonuses.length ? r.bonuses.map((b) => m.race.bonuses[b.type]).join(", ") : m.results.none}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <figure className="min-w-0" aria-labelledby={`${uid}-chart`}>
      <figcaption id={`${uid}-chart`} className="text-lg font-medium">{m.results.chart}</figcaption>
      <svg viewBox="0 0 720 290" role="img" aria-labelledby={`${uid}-chart-title ${uid}-chart-desc`} className="w-full text-mist">
        <title id={`${uid}-chart-title`}>{m.results.chart}</title>
        <desc id={`${uid}-chart-desc`}>{m.results.chartSummary} {results.map((r) => format(m.results.seriesSummary, { name: r.name, mpm: number.format(r.netMpm), time: duration(r.elapsedMs) })).join(" ")}</desc>
        {[0, 1, 2, 3, 4].map((tick) => {
          const x = 60 + tick * 150;
          const y = 240 - tick * 50;
          return <g key={tick} className="font-mono text-xs">
            <path d={`M60 ${y}H660`} className="stroke-line" fill="none" />
            <text x="52" y={y + 4} textAnchor="end" fill="currentColor">{number.format(scales.maxMpm * tick / 4)}</text>
            <text x={x} y="260" textAnchor="middle" fill="currentColor">{number.format(scales.maxTime * tick / 4)}</text>
          </g>;
        })}
        <path d="M60 40V240H660" stroke="currentColor" fill="none" />
        <text x="60" y="22" fill="currentColor" className="text-xs">{m.race.mpm}</text>
        <text x="360" y="282" textAnchor="middle" fill="currentColor" className="text-xs">{m.results.seconds}</text>
        {results.map((r, index) => {
          const points = [{ t: 0, mpm: 0 }, ...r.series, { t: r.elapsedMs ?? r.series.at(-1)?.t ?? 0, mpm: r.netMpm }];
          // Longueur et espacement des tirets restent uniques même avec 30 coureurs.
          const dash = index < strokes.length ? strokes[index] : `${index + 2} 3 2 ${index + 3}`;
          return <polyline key={r.id} points={points.map((p) => `${scales.x(p.t)},${scales.y(p.mpm)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={dash} className={colors[index % colors.length]} />;
        })}
      </svg>
      <ul aria-label={m.results.legend} className="flex flex-wrap gap-3 text-sm">{results.map((r, index) => <li key={r.id} className="flex items-center gap-2">
        <svg width="40" height="12" aria-hidden className={colors[index % colors.length]}><path d="M0 6H40" stroke="currentColor" strokeWidth="2" strokeDasharray={index < strokes.length ? strokes[index] : `${index + 2} 3 2 ${index + 3}`} /></svg>{r.name}
      </li>)}</ul>
    </figure>

    {selectable ? <label className="flex flex-col gap-2">{m.results.chooseParticipant}<select className={inputClass} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{results.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label> : null}
    {selected ? <section aria-labelledby={`${uid}-keyboard`} className="flex flex-col gap-3">
      <h3 id={`${uid}-keyboard`} className="text-lg font-medium">{format(m.results.keyboard, { name: selected.name })}</h3>
      <p className="text-sm text-mist">{m.results.keyboardSummary}</p>
      <div className="overflow-x-auto"><div className="flex min-w-max flex-col items-center gap-1">
        {rows.map((row, index) => <ul key={index} className="flex gap-1">{row.map(keycap)}</ul>)}
        <ul className="flex gap-1">{[" ", ...extras].map(keycap)}</ul>
      </div></div>
    </section> : null}
  </section>;
}
