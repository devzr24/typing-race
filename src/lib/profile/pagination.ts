export const HISTORY_PAGE_SIZE = 10;

export function historyPagination(value: string | string[] | undefined, count: number) {
  const pages = Math.max(1, Math.ceil(count / HISTORY_PAGE_SIZE));
  const requested = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 1;
  const page = Math.max(1, Math.min(pages, requested));
  return { page, pages, skip: (page - 1) * HISTORY_PAGE_SIZE, take: HISTORY_PAGE_SIZE };
}
