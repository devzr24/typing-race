type ProfileResult = { wpm: number; accuracy: number; rank: number; outcome: string };

/** Toutes les participations persistées ; seule une arrivée au rang 1 est une victoire. */
export function profileStats(results: readonly ProfileResult[]) {
  const count = results.length;
  const finished = results.filter((r) => r.outcome === "TERMINE");
  return {
    count,
    wins: results.filter((r) => r.rank === 1 && r.outcome === "TERMINE").length,
    bestWpm: finished.reduce((best, r) => Math.max(best, r.wpm), 0),
    averageWpm: finished.length ? finished.reduce((sum, r) => sum + r.wpm, 0) / finished.length : 0,
    averageAccuracy: finished.length ? finished.reduce((sum, r) => sum + r.accuracy, 0) / finished.length : 0,
  };
}
