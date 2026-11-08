import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Avatar } from "@/components/avatar";
import { format } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { profileStats } from "@/lib/profile/stats";
import { chartScales } from "@/lib/race/results-visuals";
import { ProfileForms } from "./profile-forms";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.profile.title} — ${m.app.name}` };
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user.id || session.user.isGuest) redirect("/login");
  const [m, locale, user, results] = await Promise.all([
    getMessages(), getLocale(),
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.raceResult.findMany({
      where: { userId: session.user.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, wpm: true, accuracy: true, rank: true, outcome: true, race: { select: { endedAt: true } } },
    }),
  ]);
  const stats = profileStats(results);
  const finished = results.filter((r) => r.outcome === "TERMINE");
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  const start = finished[0]?.race.endedAt.getTime() ?? 0;
  const series = finished.map((r) => ({ t: r.race.endedAt.getTime() - start, mpm: r.wpm }));
  const scales = chartScales([{ series, elapsedMs: series.at(-1)?.t, netMpm: stats.bestWpm }]);
  const values = [
    [m.profile.bestWpm, number.format(stats.bestWpm)], [m.profile.averageWpm, number.format(stats.averageWpm)],
    [m.profile.averageAccuracy, percent.format(stats.averageAccuracy / 100)],
    [m.profile.count, integer.format(stats.count)], [m.profile.wins, integer.format(stats.wins)],
  ];
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">{m.profile.title}</h1>
    <div className="flex items-center gap-2"><Avatar name={user.name ?? user.username} image={user.image} />{user.name ?? user.username}</div>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">{values.map(([label, value]) => <div key={label} className="rounded border border-line bg-card p-3">
      <dt className="text-sm text-mist">{label}</dt><dd className="font-mono text-xl">{value}</dd>
    </div>)}</dl>
    {finished.length ? <figure aria-labelledby="profile-chart">
      <figcaption id="profile-chart" className="text-lg font-medium">{m.profile.chart}</figcaption>
      <svg viewBox="0 0 720 300" role="img" aria-labelledby="profile-chart-title profile-chart-desc" className="w-full text-mist">
        <title id="profile-chart-title">{m.profile.chart}</title>
        <desc id="profile-chart-desc">{m.profile.chartSummary}</desc>
        {[0, 1, 2, 3, 4].map((tick) => <g key={tick} className="font-mono text-xs">
          <path d={`M60 ${240 - tick * 50}H660`} className="stroke-line" fill="none" />
          <text x="52" y={244 - tick * 50} textAnchor="end" fill="currentColor">{number.format(scales.maxMpm * tick / 4)}</text>
        </g>)}
        <path d="M60 40V240H660" stroke="currentColor" fill="none" />
        <text x="60" y="22" fill="currentColor" className="text-xs">{m.race.mpm}</text>
        <text x="60" y="270" fill="currentColor" className="text-xs">{date.format(finished[0].race.endedAt)}</text>
        <text x="660" y="290" textAnchor="end" fill="currentColor" className="text-xs">{date.format(finished.at(-1)!.race.endedAt)}</text>
        <polyline points={series.map((p) => `${scales.x(p.t)},${scales.y(p.mpm)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan" />
        {series.map((p, index) => <circle key={finished[index].id} cx={scales.x(p.t)} cy={scales.y(p.mpm)} r="3" fill="currentColor" className="text-cyan">
          <title>{format(m.profile.point, { date: date.format(finished[index].race.endedAt), mpm: number.format(p.mpm) })}</title>
        </circle>)}
      </svg>
    </figure> : <p className="text-mist">{m.profile.empty}</p>}
    <ProfileForms name={user.name ?? user.username} />
  </main>;
}
