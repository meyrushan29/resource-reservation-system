/**
 * Assigns side-by-side lanes to overlapping blocks within one calendar column.
 * Confirmed reservations never overlap on the same resource, but cancelled ones
 * (when shown) can overlap confirmed ones, so they need their own lane.
 */
export interface LaidOut<T> {
  item: T;
  lane: number;
  lanes: number;
}

export function assignLanes<T extends { startsAt: Date; endsAt: Date }>(items: T[]): LaidOut<T>[] {
  const sorted = [...items].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || b.endsAt.getTime() - a.endsAt.getTime(),
  );
  const result: LaidOut<T>[] = [];
  let cluster: LaidOut<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const entry of cluster) entry.lanes = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    const start = item.startsAt.getTime();
    if (start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = item.endsAt.getTime();
    clusterEnd = Math.max(clusterEnd, item.endsAt.getTime());
    cluster.push({ item, lane, lanes: 1 });
  }
  flush();
  return result;
}
