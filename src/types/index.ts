export type Decision   = 'LONG' | 'SHORT' | 'WAIT' | 'NO TRADE';
export type Direction  = 'LONG' | 'SHORT';
export type TradeGrade = 'A+' | 'A' | 'B' | 'C' | '—';
export type Regime     = 'BULL' | 'BEAR' | 'RANGE' | 'TRANSITION' | 'DISTRIBUTION' | 'ACCUMULATION';
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
  agents:            AgentReport[];
  invalidation:      InvalidationLayers;
  thesis:            ThesisState;
  memory:            MemoryRecord;
  alertMessage:      AlertMessage | null;
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
