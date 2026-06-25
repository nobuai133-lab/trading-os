// Core State Kernel — master type definitions.
// All kernel files import from here. This file imports nothing from within the kernel.

// ── Domains ───────────────────────────────────────────────────────────────────

export type KernelDomain =
  | 'trade' | 'market' | 'provider' | 'strategy' | 'evidence' | 'risk'
  | 'lifecycle' | 'memory' | 'portfolio' | 'notification' | 'backtest'
  | 'replay' | 'system';

export const KERNEL_DOMAINS: KernelDomain[] = [
  'trade', 'market', 'provider', 'strategy', 'evidence', 'risk',
  'lifecycle', 'memory', 'portfolio', 'notification', 'backtest',
  'replay', 'system',
];

// ── Trade State Machine ───────────────────────────────────────────────────────

export type TradePhase =
  | 'IDLE'
  | 'SETUP_DETECTED'
  | 'WAIT_CONFIRMATION'
  | 'ENTRY_READY'
  | 'POSITION_OPEN'
  | 'TP1_REACHED'
  | 'TP2_REACHED'
  | 'TP3_REACHED'
  | 'POSITION_CLOSED'
  | 'POST_REVIEW'
  | 'WAIT_NEW_SETUP';

export type KernelLifecycleMode =
  | 'IDLE' | 'SETUP_DETECTED' | 'WAIT_CONFIRMATION' | 'ENTRY_READY'
  | 'ACTIVE_TRADE' | 'POST_TRADE_REVIEW' | 'WAIT_NEW_SETUP' | 'COOLDOWN';

// ── KernelEvent ───────────────────────────────────────────────────────────────

export interface KernelEvent {
  id:            string;
  seq:           bigint;
  ts:            string;    // ISO 8601 UTC
  correlationId: string;
  sessionId:     string;
  source:        string;    // 'webhook' | 'cron' | 'risk' | 'memory' | 'kernel'
  domain:        KernelDomain;
  type:          string;    // 'SetupDetected' | 'EntryConfirmed' | etc.
  version:       number;    // event schema version
  tradeId?:      string;
  setupId?:      string;
  previousSeq:   bigint;    // seq of last event in global chain (0n if first)
  payload:       Record<string, unknown>;
}

export interface KernelEventInput {
  correlationId: string;
  source:        string;
  domain:        KernelDomain;
  type:          string;
  version?:      number;
  tradeId?:      string;
  setupId?:      string;
  payload:       Record<string, unknown>;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface KernelValidationError {
  code:    string;   // KERNEL-1001 … KERNEL-3999
  message: string;
  field?:  string;
}

export interface KernelValidationWarning {
  code:    string;
  message: string;
}

export interface ValidationResult {
  valid:    boolean;
  errors:   KernelValidationError[];
  warnings: KernelValidationWarning[];
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface KernelSnapshot {
  id:         string;
  seq:        bigint;
  createdAt:  string;
  eventCount: number;
  state:      KernelFullState;
}

// ── Domain State: Trade ───────────────────────────────────────────────────────

export interface TradeState {
  phase:        TradePhase;
  stateVersion: bigint;
  tradeId?:     string;
  setupId?:     string;
  symbol?:      string;
  timeframe?:   string;
  direction?:   string;
  entry?:       number;
  sl?:          number;
  tp1?:         number;
  tp2?:         number;
  tp3?:         number;
  tp1Hit:       boolean;
  tp2Hit:       boolean;
  tp3Hit:       boolean;
  riskPct?:     number;
  resultR?:     number;
  openedAt?:    string;
  closedAt?:    string;
  closeReason?: string;
  reconciled?:  string[];   // event types auto-reconciled (e.g. 'TP1HitReconciled')
  lastEventId?: string;
  lastEventTs?: string;
}

// ── Domain State: Market ──────────────────────────────────────────────────────

export interface MarketState {
  symbol:       string;
  price:        number;
  bid?:         number;
  ask?:         number;
  volume24h?:   number;
  provider:     string;
  ts:           number;    // unix ms of last price update
  stateVersion: bigint;
  lastEventId?: string;
}

// ── Domain State: Provider ────────────────────────────────────────────────────

export interface ProviderHealthEntry {
  provider:     string;
  available:    boolean;
  overallScore: number;
  latency:      number;
  availability: number;
  lastCheck:    string;
  lastError?:   string;
}

export interface FailoverEntry {
  from:   string;
  to:     string;
  reason: string;
  ts:     string;
}

export interface ProviderState {
  activeProvider:   string;
  providers:        ProviderHealthEntry[];
  failoverLog:      FailoverEntry[];
  lastHealthCheck?: string;
  stateVersion:     bigint;
  lastEventId?:     string;
}

// ── Domain State: Strategy ────────────────────────────────────────────────────

export interface StrategyState {
  symbol:       string;
  timeframe:    string;
  regime:       string;
  ema20:        number;
  ema50:        number;
  atr:          number;
  confidence:   number;
  htfBias:      string;
  ltfBias:      string;
  keyLevels:    unknown[];
  lastAnalyzed: string;
  stateVersion: bigint;
  lastEventId?: string;
}

// ── Domain State: Evidence ────────────────────────────────────────────────────

export interface EvidenceCategory {
  name:    string;
  score:   number;
  present: boolean;
  note?:   string;
}

export interface EvidenceState {
  correlationId: string;
  symbol:        string;
  tradeId?:      string;
  grade:         string;
  confidence:    number;
  categories:    EvidenceCategory[];
  lastUpdated:   string;
  stateVersion:  bigint;
  lastEventId?:  string;
}

// ── Domain State: Risk ────────────────────────────────────────────────────────

export interface RiskDecisionRecord {
  allowed: boolean;
  reason?: string;
  gate?:   string;
  ts:      string;
}

export interface RiskState {
  tradingMode:    'PAPER_TRADING' | 'ALERT_ONLY' | 'LIVE';
  killSwitch:     boolean;
  defaultRiskPct: number;
  maxRiskPct:     number;
  minRr:          number;
  minConfidence:  number;
  activeGates:    string[];
  lastDecision?:  RiskDecisionRecord;
  stateVersion:   bigint;
  lastEventId?:   string;
}

// ── Domain State: Lifecycle ───────────────────────────────────────────────────

export interface LifecycleState {
  mode:           KernelLifecycleMode;
  lifecycleIndex: number;
  activeSetupId?: string;
  cooldownActive: boolean;
  stateVersion:   bigint;
  lastEventId?:   string;
}

// ── Domain State: Memory ──────────────────────────────────────────────────────

export interface KernelRangeMemory {
  rangeId:            string;
  status:             string;
  rangeHigh:          number;
  rangeLow:           number;
  freshLiquidity:     boolean;
  reentryAllowed:     boolean;
  tradeCount:         number;
  lastTradeResult?:   string;
  lastTradeDirection?: string;
}

export interface KernelFingerprint {
  id:            string;
  alreadyTraded: boolean;
  tradedAt?:     string;
  result?:       string;
}

export interface KernelCooldown {
  active:        boolean;
  remainingBars: number;
  totalBars:     number;
  activatedAt?:  string;
  reason?:       string;
}

export interface MemoryState {
  rangeMemory:  KernelRangeMemory | null;
  fingerprint:  KernelFingerprint | null;
  cooldown:     KernelCooldown;
  blocked:      boolean;
  blockReason?: string;
  nextRequired: string[];
  stateVersion: bigint;
  lastEventId?: string;
}

// ── Domain State: Portfolio ───────────────────────────────────────────────────

export interface PortfolioState {
  totalTrades:     number;
  wins:            number;
  losses:          number;
  winRate:         number;
  profitFactor:    number;
  totalR:          number;
  maxDrawdown:     number;
  currentDrawdown: number;
  peakR:           number;
  lastUpdated:     string;
  stateVersion:    bigint;
  lastEventId?:    string;
}

// ── Domain State: Notification ────────────────────────────────────────────────

export interface ChannelStatus {
  channel:     string;
  healthy:     boolean;
  lastChecked: string;
}

export interface NotificationState {
  lastSent:      Record<string, string>;   // eventType → ISO ts of last send
  channels:      ChannelStatus[];
  rateLimitHits: number;
  stateVersion:  bigint;
  lastEventId?:  string;
}

// ── Domain State: Backtest ────────────────────────────────────────────────────

export type BacktestStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';

export interface BacktestState {
  status:             BacktestStatus;
  tradeCount:         number;
  minTradesRequired:  number;
  governanceApproved: boolean;
  approvedAt?:        string;
  approvedBy?:        string;
  notes?:             string;
  stateVersion:       bigint;
  lastEventId?:       string;
}

// ── Domain State: Replay ──────────────────────────────────────────────────────

export interface ReplayState {
  active:        boolean;
  fromSeq:       bigint;
  toSeq:         bigint;
  currentSeq:    bigint;
  playbackSpeed: number;
  paused:        boolean;
  stateVersion:  bigint;
  lastEventId?:  string;
}

// ── Domain State: System ──────────────────────────────────────────────────────

export interface KernelSystemState {
  version:          string;
  startedAt:        string;
  lastEventSeq:     bigint;
  snapshotSeq:      bigint;
  eventCount:       number;
  healthy:          boolean;
  healthCheckedAt?: string;
  stateVersion:     bigint;
  lastEventId?:     string;
}

// ── Full State ────────────────────────────────────────────────────────────────

export interface KernelFullState {
  trade:        TradeState;
  market:       MarketState;
  provider:     ProviderState;
  strategy:     StrategyState;
  evidence:     EvidenceState;
  risk:         RiskState;
  lifecycle:    LifecycleState;
  memory:       MemoryState;
  portfolio:    PortfolioState;
  notification: NotificationState;
  backtest:     BacktestState;
  replay:       ReplayState;
  system:       KernelSystemState;
}

export type DomainStates = {
  [K in KernelDomain]: KernelFullState[K];
};

// ── bigint JSON serialization ─────────────────────────────────────────────────
// Prisma returns bigint natively. For JSON (snapshots, API responses),
// convert bigint → string on write and string → bigint on read.

export function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export const BIGINT_STATE_FIELDS = new Set([
  'seq', 'previousSeq', 'stateVersion', 'lastEventSeq', 'snapshotSeq',
  'fromSeq', 'toSeq', 'currentSeq',
]);

export function reviveBigIntFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(reviveBigIntFields);
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = BIGINT_STATE_FIELDS.has(k) && typeof v === 'string'
        ? BigInt(v)
        : reviveBigIntFields(v);
    }
    return out;
  }
  return obj;
}
