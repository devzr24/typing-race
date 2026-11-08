import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buttonClass } from "@/components/form-field";
import { format } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { historyPagination } from "@/lib/profile/pagination";

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return { title: `${m.history.title} — ${m.app.name}` };
}

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const session = await auth();
  if (!session?.user.id || session.user.isGuest) redirect("/login");
  const where = { userId: session.user.id };
  const [m, locale, count, query] = await Promise.all([
    getMessages(), getLocale(), prisma.raceResult.count({ where }), searchParams,
  ]);
  const pagination = historyPagination(query.page, count);
  const results = await prisma.raceResult.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: pagination.skip, take: pagination.take,
    select: { id: true, raceId: true, wpm: true, accuracy: true, rank: true, outcome: true, race: { select: { endedAt: true } } },
  });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  const outcomes = { TERMINE: "finished", TEMPS_ECOULE: "timeout", ABANDON: "abandoned" } as const;
  return <main id="contenu" tabIndex={-1} className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
    <h1 className="text-2xl font-semibold">{m.history.title}</h1>
    {!results.length ? <p className="text-mist">{m.history.empty}</p> : <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={m.history.title}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{m.history.title}</caption>
        <thead><tr>{[m.history.date, m.race.netMpm, m.race.accuracy, m.results.rank, m.results.status].map((label) => <th key={label} scope="col" className="border-b border-line p-3">{label}</th>)}</tr></thead>
        <tbody>{results.map((r) => <tr key={r.id}>
          <th scope="row" className="border-b border-line p-3"><Link href={`/races/${r.raceId}`} className="text-cyan underline">{date.format(r.race.endedAt)}</Link></th>
          <td className="border-b border-line p-3">{number.format(r.wpm)}</td>
          <td className="border-b border-line p-3">{percent.format(r.accuracy / 100)}</td>
          <td className="border-b border-line p-3">{integer.format(r.rank)}</td>
          <td className="border-b border-line p-3">{m.results.outcomes[outcomes[r.outcome]]}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    <nav aria-label={m.history.pagination} className="flex flex-wrap items-center gap-3">
      {pagination.page > 1 ? <Link href={`/history?page=${pagination.page - 1}`} className={buttonClass}>{m.history.previous}</Link> : null}
      <span>{format(m.history.page, { page: integer.format(pagination.page), pages: integer.format(pagination.pages) })}</span>
      {pagination.page < pagination.pages ? <Link href={`/history?page=${pagination.page + 1}`} className={buttonClass}>{m.history.next}</Link> : null}
    </nav>
  </main>;
}
