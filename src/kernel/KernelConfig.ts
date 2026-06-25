import { randomBytes } from 'crypto';

function envNum(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

export const KernelConfig = {
  // How many events between automatic snapshots.
  // Configurable via STATE_SNAPSHOT_INTERVAL env var.
  snapshotInterval: envNum('STATE_SNAPSHOT_INTERVAL', 100),

  // Maximum events to replay before falling back to full scan.
  maxReplayEvents: envNum('STATE_MAX_REPLAY_EVENTS', 10_000),

  // Max retry attempts for optimistic locking conflicts on seq.
  maxSeqRetries: 3,

  // Session ID: set once per process start. Identifies the Railway deployment.
  sessionId: process.env.RAILWAY_DEPLOYMENT_ID
    ?? process.env.RAILWAY_REPLICA_ID
    ?? `dev-${randomBytes(4).toString('hex')}`,

  // ITOS version string stamped into KernelSystemState.
  itosVersion: process.env.npm_package_version ?? '1.3.0',
} as const;
