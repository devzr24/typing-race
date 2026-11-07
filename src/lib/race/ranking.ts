export interface RaceParticipant {
  id: string;
  status: "finished" | "timeout" | "abandoned";
  finishMs?: number;
  progress: number;
  joinedAt: number;
}

const STATUS_ORDER = { finished: 0, timeout: 1, abandoned: 2 };

export function rankParticipants<T extends RaceParticipant>(participants: readonly T[]): (T & { rank: number })[] {
  return [...participants].sort((a, b) => {
    const status = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (status !== 0) return status;
    // Un temps absent est classé après les temps connus.
    const result = a.status === "finished"
      ? (a.finishMs ?? Infinity) - (b.finishMs ?? Infinity)
      : b.progress - a.progress;
    return (Number.isNaN(result) ? 0 : result) || a.joinedAt - b.joinedAt;
  }).map((participant, index) => ({ ...participant, rank: index + 1 }));
}
