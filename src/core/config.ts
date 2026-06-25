function opt(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optNum(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function optBool(key: string, fallback: boolean): boolean {
  const v = process.env[key]?.toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

export const config = {
  cloud: {
    nodeEnv: opt('NODE_ENV', 'production') as 'development' | 'production' | 'test',
    port:    optNum('PORT', 3000),
  },
  database: {
    url: opt('DATABASE_URL', ''),
  },
  security: {
    webhookSecret: opt('WEBHOOK_SECRET', ''),
    cronSecret:    opt('CRON_SECRET', ''),
    jwtSecret:     opt('JWT_SECRET', 'dev-jwt-secret-replace-in-production'),
  },
  exchange: {
    tradingMode:    opt('TRADING_MODE', 'PAPER_TRADING') as 'PAPER_TRADING' | 'ALERT_ONLY' | 'LIVE',
    killSwitch:     optBool('KILL_SWITCH', false),
    defaultRiskPct: optNum('DEFAULT_RISK_PCT', 1),
    maxRiskPct:     optNum('MAX_RISK_PCT', 2),
    minRr:          optNum('MIN_RR', 1.5),
    minConfidence:  optNum('MIN_CONFIDENCE', 30),
  },
  notifications: {
    telegramBotToken: opt('TELEGRAM_BOT_TOKEN', ''),
    telegramChatId:   opt('TELEGRAM_CHAT_ID', ''),
  },
  claude: {
    apiKey:          opt('CLAUDE_API_KEY', ''),
    maxDailyRequests: optNum('CLAUDE_MAX_DAILY', 10),
    minGrade:        opt('CLAUDE_MIN_GRADE', 'B'),
    minConfidence:   optNum('CLAUDE_MIN_CONFIDENCE', 60),
  },
  rateLimit: {
    webhookPerMin: optNum('WEBHOOK_RATE_LIMIT', 10),
    apiPerMin:     optNum('API_RATE_LIMIT', 60),
  },
  cooldown: {
    tp3Bars4H: optNum('TP3_COOLDOWN_4H', 4),
    tp3Bars1D: optNum('TP3_COOLDOWN_1D', 2),
    slBars4H:  optNum('SL_COOLDOWN_4H', 3),
    slBars1D:  optNum('SL_COOLDOWN_1D', 1),
  },
  stale: {
    rangeDays: optNum('RANGE_STALE_DAYS', 7),
  },
  dedup: {
    windowMs: optNum('WEBHOOK_DEDUP_MS', 60_000),
  },
};

export type Config = typeof config;
