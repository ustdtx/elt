export interface TurnSample {
  firstTokenMs: number;
  totalMs: number;
}

const MAX_SAMPLES = 200;
const samples: TurnSample[] = [];

export function recordTurn(sample: TurnSample): void {
  samples.push(sample);
  if (samples.length > MAX_SAMPLES) samples.shift();
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[index]);
}

export function metricsSnapshot() {
  const firstToken = samples.map((s) => s.firstTokenMs);
  const total = samples.map((s) => s.totalMs);
  return {
    turns: samples.length,
    firstTokenMs: { p50: percentile(firstToken, 50), p95: percentile(firstToken, 95) },
    totalMs: { p50: percentile(total, 50), p95: percentile(total, 95) },
    last: samples[samples.length - 1] ?? null,
  };
}
