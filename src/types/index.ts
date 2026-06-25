export type Decision   = 'LONG' | 'SHORT' | 'WAIT' | 'NO TRADE';
export type Direction  = 'LONG' | 'SHORT';
export type TradeGrade = 'A+' | 'A' | 'B' | 'C' | '—';
export type Regime     = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'UNKNOWN' | 'BULL' | 'BEAR' | 'RANGE' | 'TRANSITION' | 'DISTRIBUTION' | 'ACCUMULATION';
export type TradeStatus =
  | 'IDLE' | 'WAITING' | 'READY' | 'ENTERED' | 'ACTIVE'
  | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT'
  | 'CLOSED_WIN' | 'CLOSED_LOSS' | 'CLOSED_MANUAL'
  | 'EXPIRED' | 'INVALIDATED';
export type SLStatus  = 'INITIAL' | 'BREAKEVEN' | 'TRAILING' | 'HIT' | 'CLOSED' | 'N/A';
export type SystemMode =
  | 'IDLE' | 'SETUP_DETECTED' | 'WAIT_CONFIRMATION' | 'ENTRY_READY'
  | 'ACTIVE_TRADE' | 'POST_TRADE_REVIEW' | 'WAIT_NEW_SETUP' | 'COOLDOWN';
export type AgentType = 'bearish' | 'bullish' | 'valid' | 'warning' | 'neutral' | 'invalid';
export type InvStatus = 'VALID' | 'WARNING' | 'INVALID';
export type AssumptionStatus = 'ACTIVE' | 'WEAKENED' | 'FAILED';
export type AlertType = 'warn' | 'danger' | 'success';

export type SetupStatus = 'WATCHING' | 'TRIGGERED' | 'INVALIDATED';

export type SetupLifecycleStatus =
  | 'NEW' | 'ACTIVE' | 'TRADED' | 'COMPLETED'
  | 'EXPIRED' | 'INVALIDATED' | 'STALE';

export type RangeStatus = 'NEW' | 'ACTIVE' | 'TRADED' | 'STALE' | 'RESET';

export interface EntryZone {
  low:  number;
  high: number;
}

export interface SetupFingerprint {
  id:                string;
  symbol:            string;
  timeframe:         string;
  direction:         Direction;
  rangeHigh:         number;
  rangeLow:          number;
  entryZoneHigh:     number;
  entryZoneLow:      number;
  thesisType:        string;
  status:            SetupLifecycleStatus;
  alreadyTraded:     boolean;
  sameSetupDetected: boolean;
  lastTradedAt?:     string;
}

export interface RangeMemory {
  rangeId:              string;
  status:               RangeStatus;
  rangeHigh:            number;
  rangeLow:             number;
  midline:              number;
  width:                number;
  createdAt:            string;
  lastTouchedAt:        string;
  tradeCount:           number;
  lastTradeDirection?:  Direction;
  lastTradeResult?:     string;
  freshLiquidity:       boolean;
  reentryAllowed:       boolean;
}

export interface CooldownState {
  active:        boolean;
  remainingBars: number;
  totalBars:     number;
  activatedAt?:  string;
  reason?:       string;
}

export interface AntiReentryState {
  rangeMemory:            RangeMemory | null;
  setupFingerprint:       SetupFingerprint | null;
  cooldown:               CooldownState;
  blocked:                boolean;
  overrideReason?:        string;
  nextRequiredConditions: string[];
}

export interface PendingSetup {
  id:              string;
  label:           string;
  direction:       Direction;
  grade:           TradeGrade;
  entryZone:       EntryZone;
  sl:              number;
  tp1:             number;
  tp2:             number;
  tp3:             number;
  rr:              number;
  status:          SetupStatus;
  note:            string;
  inZone?:         boolean;
  lifecycleStatus?: SetupLifecycleStatus;
  fingerprintId?:  string;
  tradeCount?:     number;
}

export interface Trade {
  direction:    Direction | '—';
  grade:        TradeGrade;
  status:       TradeStatus;
  entry:        number;
  entryZone?:   EntryZone;
  sl:           number;
  slCurrent:    number;
  slStatus:     SLStatus;
  tp1:          number;
  tp2:          number;
  tp3:          number;
  tp1Hit:       boolean;
  tp2Hit:       boolean;
  tp3Hit:       boolean;
  riskPct:      number;
  rr:           number;
  sizeBtc:      number;
  expiryBars:   number;
  openPct:      number;
  unrealizedR:  number;
}

export interface AgentReport {
  id:     string;
  label:  string;
  status: string;
  type:   AgentType;
}

export interface DecayEvent {
  label: string;
  conf:  number;
  delta?: number;
}

export interface InvalidationLayer {
  status:  InvStatus;
  trigger: string;
  impact:  string;
  detail:  string;
}

export interface InvalidationLayers {
  price:     InvalidationLayer;
  structure: InvalidationLayer;
  time:      InvalidationLayer;
  thesis:    InvalidationLayer;
}

export interface ThesisAssumption {
  id:     string;
  label:  string;
  status: AssumptionStatus;
}

export interface ThesisState {
  score:       number;
  assumptions: ThesisAssumption[];
}

export interface MemoryRecord {
  tradeId:       string;
  direction:     Direction | '—';
  timeframe:     string;
  entry:         number;
  tp1:           number | null;
  tp2:           number | null;
  tp3:           number | null;
  result:        string;
  status:        TradeStatus;
  biasCarryover: boolean;
  lesson:        string;
  mistake:       string;
  currentMode:   SystemMode;
}

export interface AlertMessage {
  type: AlertType;
  text: string;
}

export interface KeyLevel {
  price:     number;
  type:      'RESISTANCE' | 'SUPPORT' | 'LIQUIDITY_HIGH' | 'LIQUIDITY_LOW';
  strength:  number;
  timeframe: string;
  source:    'SWING' | 'LIQUIDITY';
}

export type MarketDataBadge = 'LIVE' | 'CANDLE_CLOSED' | 'STALE' | 'FALLBACK' | 'MOCK' | 'ERROR';

export interface MarketDataStatus {
  provider:                 string;
  candleProvider:           string;
  symbol:                   string;
  timeframe:                string;
  latestPrice:              number;
  latestPriceTimestamp:     string;
  latestClosedCandleTs:     string;
  candleAgeSeconds:         number;
  analysisAgeSeconds:       number;
  isTickerFresh:            boolean;
  isCandleFresh:            boolean;
  isAnalysisFresh:          boolean;
  badge:                    MarketDataBadge;
  warning?:                 string;
}

export interface DashboardState {
  symbol:            string;
  timeframe:         string;
  price:             number;
  mode:              SystemMode;
  lifecycleIndex:    number;
  decision:          Decision;
  confidence:        number;
  confidenceHistory: number[];
  decayEvents:       DecayEvent[];
  riskGrade:         string;
  regime:            Regime;
  htfBias:           string;
  ltfBias:           string;
  trade:             Trade;
  pendingSetups?:    PendingSetup[];
  antiReentry?:      AntiReentryState;
  keyLevels?:        KeyLevel[];
  agents:            AgentReport[];
  invalidation:      InvalidationLayers;
  thesis:            ThesisState;
  memory:            MemoryRecord;
  alertMessage:      AlertMessage | null;
  marketDataStatus?: MarketDataStatus;
}

// ── Memory Intelligence Layer types ──────────────────────────────────────────

export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAK_EVEN';

export type ExperienceLevel = 'INSUFFICIENT' | 'LOW' | 'MODERATE' | 'HIGH';

export interface SetupFingerprintData {
  // Trend
  trend:        'BULL' | 'BEAR' | 'RANGE' | 'UNKNOWN';
  emaAlignment: 'ALIGNED' | 'MISALIGNED' | 'UNKNOWN';

  // Structure
  htfBias:      'BULL' | 'BEAR' | 'NEUTRAL';
  ltfBias:      'BULL' | 'BEAR' | 'NEUTRAL';

  // Liquidity
  liquiditySweep: boolean;

  // Acceptance
  rangeAcceptance: boolean;
  atRangeExtreme:  boolean;

  // Retest (not available in v1)
  hasRetest: boolean;

  // Momentum
  momentum: 'STRONG' | 'MEDIUM' | 'WEAK' | 'UNKNOWN';

  // Volume
  volume: 'AVAILABLE' | 'UNAVAILABLE';

  // Risk bucketed
  rrBucket:    'HIGH' | 'MEDIUM' | 'LOW';
  gradeBucket: 'A' | 'B' | 'C' | 'D';
  riskBucket:  'HIGH' | 'MEDIUM' | 'LOW';

  // Context
  provider:  string;
  timeframe: string;
  regime:    string;
  direction: 'LONG' | 'SHORT';

  // Deterministic SHA-1 of canonical fields
  hash: string;
}

export interface TradeMemoryRecord {
  tradeId:    string;
  decisionId: string;
  symbol:     string;
  timeframe:  string;

  regime:    string;
  provider:  string;
  htfBias:   string;
  ltfBias:   string;

  evidenceGrade:         string;
  evidenceConfidence:    number;
  evidenceCategories:    Array<{ name: string; present: boolean; score: number }>;

  decisionOutcome:       string;
  decisionConfidence:    number;
  decisionWeightedScore: number;

  direction: 'LONG' | 'SHORT';
  grade:     string;
  rr:        number;
  riskPct:   number;

  entry: number;
  sl:    number;
  tp1:   number;
  tp2:   number;
  tp3:   number;
  exit:  number;

  outcome:     TradeOutcome;
  resultR:     number;
  closeReason: string;

  openedAt:   string;
  closedAt:   string;
  durationMs: number;

  fingerprint: SetupFingerprintData;
  dna:         string[];
  dnaHash:     string;

  confidenceBefore: number;
  confidenceAfter:  number;
  lessons:          string[];
  tags:             string[];
}

export interface SimilarityMatch {
  record:     TradeMemoryRecord;
  similarity: number;
}

export interface SimilarityResult {
  winningSimilarity:             number;
  losingSimilarity:              number;
  nearestWinner:                 SimilarityMatch | null;
  nearestLoser:                  SimilarityMatch | null;
  topWinners:                    SimilarityMatch[];
  topLosers:                     SimilarityMatch[];
  sampleSize:                    number;
  similarityConfidence:          number;
  calibratedDecisionConfidence:  number;
  warnings:                      string[];
}

export interface ExperienceLesson {
  id:         string;
  condition:  string;
  action:     'AVOID' | 'PREFER' | 'REDUCE_SIZE' | 'WARN';
  summary:    string;
  winRate:    number;
  tradeCount: number;
  totalR:     number;
  avgR:       number;
  strength:   number;
  tokens:     string[];
}

export interface MemorySummary {
  tradeCount:      number;
  winCount:        number;
  lossCount:       number;
  breakEvenCount:  number;
  winRate:         number;
  avgResultR:      number;
  totalR:          number;
  experienceLevel: ExperienceLevel;
  lastUpdated:     string;
}

// ── Decision types ────────────────────────────────────────────────────────────

export type DecisionOutcome =
  | 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE'
  | 'HOLD' | 'REDUCE_POSITION' | 'READY' | 'EXIT';

export interface WeightedEvidenceItem {
  category:     string;
  weight:       number;
  present:      boolean;
  contribution: number;
}

export interface DecisionGateResult {
  gate:    string;
  passed:  boolean;
  reason?: string;
}

export interface DecisionResult {
  outcome:        DecisionOutcome;
  confidence:     number;
  weightedScore:  number;
  maxScore:       number;
  weights:        WeightedEvidenceItem[];
  gates:          DecisionGateResult[];
  blockingReason: string | null;
  topSupporting:  string[];
  topOpposing:    string[];
  nextAction:     string;
  computedAt:     string;
}

// ── Risk Office types ──────────────────────────────────────────────────────────

export type RiskOfficeState    = 'NORMAL' | 'CAUTION' | 'REDUCE' | 'BLOCK' | 'EMERGENCY_STOP';
export type RiskOfficeDecision = 'APPROVED' | 'REDUCED' | 'BLOCKED';

export interface RiskBudget {
  maxRiskPerTradeR:       number;
  maxDailyLossR:          number;
  maxWeeklyLossR:         number;
  maxMonthlyLossR:        number;
  maxConsecutiveLosses:   number;
  maxConsecutiveWins:     number;
  cooldownAfterLossMin:   number;
  cooldownAfterWinMin:    number;
  minConfidenceForTrade:  number;
  maxConcurrentPositions: number;
  maxSameSymbolPositions: number;
}

export interface PortfolioRiskMetrics {
  dailyPnlR:         number;
  weeklyPnlR:        number;
  monthlyPnlR:       number;
  dailyLossR:        number;
  weeklyLossR:       number;
  monthlyLossR:      number;
  consecutiveLosses: number;
  consecutiveWins:   number;
  lastOutcome:       TradeOutcome | null;
  lastClosedAt:      string | null;
  tradeCountToday:   number;
  tradeCountWeek:    number;
  tradeCountMonth:   number;
}

export interface RiskOfficeCooldown {
  active:           boolean;
  reason:           string | null;
  type:             'LOSS' | 'WIN' | 'CONSECUTIVE_LOSS' | 'STALE_RANGE' | 'MEMORY' | null;
  endsAt:           string | null;
  remainingMinutes: number;
}

export interface PositionSizeRecommendation {
  baseR:                number;
  confidenceMultiplier: number;
  memoryEdgeMultiplier: number;
  riskStateMultiplier:  number;
  finalR:               number;
  rationale:            string[];
}

export interface RiskVeto {
  code:     string;
  message:  string;
  severity: 'WARN' | 'BLOCK' | 'EMERGENCY';
}

export interface RiskOfficeResult {
  decision:          RiskOfficeDecision;
  riskState:         RiskOfficeState;
  positionSize:      PositionSizeRecommendation;
  cooldown:          RiskOfficeCooldown;
  metrics:           PortfolioRiskMetrics;
  budget:            RiskBudget;
  vetos:             RiskVeto[];
  killSwitchActive:  boolean;
  killSwitchReasons: string[];
  approvalChain:     string[];
  computedAt:        string;
}

// ── Paper Trading Lifecycle types ─────────────────────────────────────────────

export type TradeDirection = 'LONG' | 'SHORT';

export type PaperPositionStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'OPEN'
  | 'PARTIAL'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ERROR';

export type PaperCloseReason =
  | 'TAKE_PROFIT'
  | 'STOP_LOSS'
  | 'MANUAL'
  | 'TIME_EXIT'
  | 'RISK_OFFICE_KILL_SWITCH'
  | 'INVALIDATED_SIGNAL'
  | 'SYSTEM_ERROR';

export interface PositionAuditEvent {
  ts:      string;
  event:   string;
  details: Record<string, unknown>;
}

export interface PaperPosition {
  positionId:   string;
  signalId:     string;
  memoryHash:   string | null;
  setupHash:    string | null;
  symbol:       string;
  timeframe:    string;
  direction:    TradeDirection;
  entryPrice:   number;
  stopLoss:     number;
  takeProfit:   number;
  tp1:          number;
  tp2:          number;
  tp3:          number;
  quantity:     number;
  baseRiskR:    number;
  finalRiskR:   number;
  openedAt:     string | null;
  updatedAt:    string;
  closedAt:     string | null;
  status:       PaperPositionStatus;
  currentPrice: number;
  unrealizedR:  number;
  realizedR:    number;
  realizedPnL:  number;
  fees:         number;
  slippage:     number;
  closeReason:  PaperCloseReason | null;
  auditTrail:   PositionAuditEvent[];
}

export interface PaperLedgerSummary {
  openCount:        number;
  closedCount:      number;
  totalRealizedR:   number;
  totalUnrealizedR: number;
  openExposureR:    number;
  winCount:         number;
  lossCount:        number;
  breakEvenCount:   number;
  winRate:          number;
  avgWinR:          number;
  avgLossR:         number;
  lastClosedAt:     string | null;
  lastCloseReason:  PaperCloseReason | null;
  updatedAt:        string;
}

export interface CreatePaperPositionInput {
  signalId:    string;
  symbol:      string;
  timeframe:   string;
  direction:   TradeDirection;
  entryPrice:  number;
  stopLoss:    number;
  tp1:         number;
  tp2:         number;
  tp3:         number;
  quantity:    number;
  baseRiskR:   number;
  finalRiskR:  number;
  memoryHash:  string | null;
  setupHash:   string | null;
}

export interface OpenPositionSignal {
  signalId:   string;
  symbol:     string;
  timeframe:  string;
  direction:  TradeDirection;
  entryPrice: number;
  stopLoss:   number;
  tp1:        number;
  tp2:        number;
  tp3:        number;
  memoryHash?: string | null;
  setupHash?:  string | null;
}

export interface PaperPositionResult {
  ok:       boolean;
  position: PaperPosition | null;
  error:    string | null;
}

export interface PaperPositionApiResponse {
  ok:               boolean;
  openPositions:    PaperPosition[];
  closedPositions:  PaperPosition[];
  summary:          PaperLedgerSummary;
}

export interface PaperCloseRequest {
  positionId: string;
  reason:     PaperCloseReason;
  exitPrice?: number;
}

export interface PaperCloseResponse {
  ok:       boolean;
  position: PaperPosition | null;
  error:    string | null;
}

// ── Replay Engine types ───────────────────────────────────────────────────────

export type ReplayStatus =
  | 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';

export interface ReplayCandle {
  timestamp: number;   // unix ms, strictly ascending
  open:      number;
  high:      number;
  low:       number;
  close:     number;
  volume:    number;
}

export interface ReplayDecisionRecord {
  index:          number;
  candle:         ReplayCandle;
  decision:       Decision;
  confidence:     number;
  riskApproved:   boolean;
  riskDecision:   RiskOfficeDecision | null;
  finalR:         number;
  positionOpened: boolean;
  positionId:     string | null;
  riskVetoReason: string | null;
  ts:             string;
}

export interface ReplaySimulatedPosition {
  positionId:  string;
  openIndex:   number;
  closeIndex:  number | null;
  direction:   TradeDirection;
  entryPrice:  number;
  stopLoss:    number;
  takeProfit:  number;
  exitPrice:   number | null;
  realizedR:   number;
  finalR:      number;
  status:      'OPEN' | 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL' | 'OPEN_AT_END';
  closeReason: string | null;
  openTs:      string;
  closeTs:     string | null;
}

export interface ReplayAuditEvent {
  ts:      string;
  index:   number;
  event:   string;
  details: Record<string, unknown>;
}

export interface ReplayMetrics {
  totalCandles:     number;
  processedCandles: number;
  totalDecisions:   number;
  longDecisions:    number;
  shortDecisions:   number;
  waitDecisions:    number;
  noTradeDecisions: number;
  approvedTrades:   number;
  blockedTrades:    number;
  riskVetoes:       number;
  tpHits:           number;
  slHits:           number;
  openAtEnd:        number;
  winRate:          number;
  totalRealizedR:   number;
  maxDrawdownR:     number;
  averageR:         number;
  expectancyR:      number;
  opportunityCostR: number;
  peakR:            number;
  currentDrawdownR: number;
}

export interface ReplayQualityScores {
  decisionQualityScore:  number;
  riskQualityScore:      number;
  memoryQualityScore:    number;
  lifecycleQualityScore: number;
  overallScore:          number;
}

export interface ReplaySession {
  replayId:           string;
  symbol:             string;
  timeframe:          string;
  exchange:           string;
  startTime:          number;
  endTime:            number;
  candles:            ReplayCandle[];
  currentIndex:       number;
  currentCandle:      ReplayCandle | null;
  visibleCandlesOnly: ReplayCandle[];
  decisions:          ReplayDecisionRecord[];
  simulatedPositions: ReplaySimulatedPosition[];
  metrics:            ReplayMetrics;
  qualityScores:      ReplayQualityScores;
  auditTrail:         ReplayAuditEvent[];
  status:             ReplayStatus;
  createdAt:          string;
  updatedAt:          string;
  completedAt:        string | null;
  errorMessage:       string | null;
  maxStepsPerRun:     number;
}

export interface ReplaySessionSummary {
  replayId:        string;
  symbol:          string;
  timeframe:       string;
  status:          ReplayStatus;
  totalCandles:    number;
  processedCandles: number;
  progress:        number;
  totalRealizedR:  number;
  winRate:         number;
  overallScore:    number;
  createdAt:       string;
  updatedAt:       string;
}

export interface ReplayStartRequest {
  symbol:          string;
  timeframe:       string;
  exchange?:       string;
  candles:         ReplayCandle[];
  maxStepsPerRun?: number;
}

export interface ReplayStepRequest  { replayId: string; }
export interface ReplayRunRequest   { replayId: string; maxSteps?: number; }
export interface ReplayPauseRequest { replayId: string; }
export interface ReplayResetRequest { replayId: string; }

export interface ReplayApiResponse {
  ok:      boolean;
  session: ReplaySession | null;
  error?:  string;
}

export interface ReplayListApiResponse {
  ok:       boolean;
  sessions: ReplaySessionSummary[];
}

// ── Replay Context Isolation ──────────────────────────────────────────────────

export interface ReplayMemoryContext {
  records:    unknown[];
  setupsSeen: Set<string>;
}

export interface ReplayRiskContext {
  consecutiveLosses: number;
  consecutiveWins:   number;
  dailyPnlR:         number;
  openPositionCount: number;
}

export interface ReplayDecisionContext {
  lastDecision: Decision | null;
  decisionCount: number;
}

// ── Backtest & Walk-Forward types (Phase 10) ──────────────────────────────────

export interface BacktestConfig {
  fees:                   number;  // fractional per side, e.g. 0.001 = 0.1%
  slippage:               number;  // fractional per side, e.g. 0.0005 = 0.05%
  initialCapital:         number;  // dollars (for display only)
  riskPerTrade:           number;  // fraction of capital per 1R, e.g. 0.01
  maxConcurrentPositions: number;
  minConfidence:          number;
}

export interface BacktestMetrics extends ReplayMetrics {
  totalFeesR:     number;
  totalSlippageR: number;
  netR:           number;
  sharpeRatio:    number;
  calmarRatio:    number;
  profitFactor:   number;
  recoveryFactor: number;
}

export interface BacktestSession extends Omit<ReplaySession, 'metrics'> {
  config:  BacktestConfig;
  metrics: BacktestMetrics;
}

export interface WalkForwardConfig {
  numWindows:    number;  // 2–10
  inSampleRatio: number;  // 0.5–0.8
}

export interface WalkForwardWindow {
  windowIndex:      number;
  inSampleStart:    number;
  inSampleEnd:      number;
  outOfSampleStart: number;
  outOfSampleEnd:   number;
}

export interface WalkForwardWindowResult {
  window:              WalkForwardWindow;
  inSampleSession:     BacktestSession;
  outOfSampleSession:  BacktestSession;
  robustnessScore:     number;
}

export interface WalkForwardResult {
  wfId:                     string;
  symbol:                   string;
  timeframe:                string;
  config:                   BacktestConfig;
  walkForwardConfig:        WalkForwardConfig;
  windows:                  WalkForwardWindowResult[];
  aggregateInSampleNetR:    number;
  aggregateOutOfSampleNetR: number;
  overallRobustnessScore:   number;
  createdAt:                string;
}

export interface BacktestStartRequest {
  candles:     ReplayCandle[];
  symbol:      string;
  timeframe:   string;
  exchange?:   string;
  config?:     Partial<BacktestConfig>;
  walkForward?: WalkForwardConfig;
}

export interface BacktestRunRequest   { backtestId: string; maxSteps?: number; }
export interface BacktestStepRequest  { backtestId: string; }
export interface BacktestResetRequest { backtestId: string; }

export interface BacktestSessionSummary {
  backtestId:   string;
  symbol:       string;
  timeframe:    string;
  status:       ReplayStatus;
  totalCandles: number;
  netR:         number;
  sharpeRatio:  number;
  winRate:      number;
  overallScore: number;
  createdAt:    string;
}

export interface BacktestApiResponse {
  ok:       boolean;
  session:  BacktestSession | null;
  error?:   string;
}

export interface BacktestListApiResponse {
  ok:       boolean;
  sessions: BacktestSessionSummary[];
}

export interface WalkForwardApiResponse {
  ok:      boolean;
  result:  WalkForwardResult | null;
  error?:  string;
}

export const LIFECYCLE_STEPS = [
  { key: 'IDLE',    label: 'Idle'    },
  { key: 'SETUP',   label: 'Setup'   },
  { key: 'CONFIRM', label: 'Confirm' },
  { key: 'ENTRY',   label: 'Entry'   },
  { key: 'ACTIVE',  label: 'Active'  },
  { key: 'TP1',     label: 'TP1'     },
  { key: 'TP2',     label: 'TP2'     },
  { key: 'TP3',     label: 'TP3'     },
  { key: 'CLOSED',  label: 'Closed'  },
  { key: 'REVIEW',  label: 'Review'  },
  { key: 'WAIT',    label: 'Wait'    },
] as const;
