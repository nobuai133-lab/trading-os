-- CreateTable
CREATE TABLE "SystemState" (
    "id" SERIAL NOT NULL,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setup" (
    "id" TEXT NOT NULL,
    "fingerprintId" TEXT,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "rangeHigh" DOUBLE PRECISION,
    "rangeLow" DOUBLE PRECISION,
    "entryZoneLow" DOUBLE PRECISION,
    "entryZoneHigh" DOUBLE PRECISION,
    "sl" DOUBLE PRECISION,
    "tp1" DOUBLE PRECISION,
    "tp2" DOUBLE PRECISION,
    "tp3" DOUBLE PRECISION,
    "rr" DOUBLE PRECISION,
    "grade" TEXT NOT NULL DEFAULT 'B',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "thesisType" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "setupId" TEXT,
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'PAPER',
    "entryPrice" DOUBLE PRECISION,
    "sl" DOUBLE PRECISION,
    "slCurrent" DOUBLE PRECISION,
    "slStatus" TEXT NOT NULL DEFAULT 'INITIAL',
    "tp1" DOUBLE PRECISION,
    "tp2" DOUBLE PRECISION,
    "tp3" DOUBLE PRECISION,
    "tp1Hit" BOOLEAN NOT NULL DEFAULT false,
    "tp2Hit" BOOLEAN NOT NULL DEFAULT false,
    "tp3Hit" BOOLEAN NOT NULL DEFAULT false,
    "slHit" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "riskPct" DOUBLE PRECISION,
    "sizeBtc" DOUBLE PRECISION,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "resultR" DOUBLE PRECISION,
    "lesson" TEXT NOT NULL DEFAULT '',
    "mistake" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RangeMemory" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "rangeHigh" DOUBLE PRECISION NOT NULL,
    "rangeLow" DOUBLE PRECISION NOT NULL,
    "midline" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "lastTradeDirection" TEXT,
    "lastTradeResult" TEXT,
    "freshLiquidity" BOOLEAN NOT NULL DEFAULT true,
    "reentryAllowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTouchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RangeMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupFingerprint" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "rangeHigh" DOUBLE PRECISION NOT NULL,
    "rangeLow" DOUBLE PRECISION NOT NULL,
    "entryZoneHigh" DOUBLE PRECISION NOT NULL,
    "entryZoneLow" DOUBLE PRECISION NOT NULL,
    "thesisType" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "alreadyTraded" BOOLEAN NOT NULL DEFAULT false,
    "tradedAt" TIMESTAMP(3),
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetupFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cooldown" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "direction" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalBars" INTEGER NOT NULL DEFAULT 5,
    "remainingBars" INTEGER NOT NULL DEFAULT 5,
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cooldown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "open" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "low" DOUBLE PRECISION,
    "regime" TEXT,
    "ema20" DOUBLE PRECISION,
    "ema50" DOUBLE PRECISION,
    "atr" DOUBLE PRECISION,
    "atr4H" DOUBLE PRECISION,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" SERIAL NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symbol" TEXT,
    "signal" TEXT,
    "setupId" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "error" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL DEFAULT 'telegram',
    "message" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setup_fingerprintId_key" ON "Setup"("fingerprintId");

-- CreateIndex
CREATE INDEX "Trade_symbol_status_idx" ON "Trade"("symbol", "status");

-- CreateIndex
CREATE INDEX "RangeMemory_symbol_timeframe_idx" ON "RangeMemory"("symbol", "timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "RangeMemory_symbol_timeframe_rangeHigh_rangeLow_key" ON "RangeMemory"("symbol", "timeframe", "rangeHigh", "rangeLow");

-- CreateIndex
CREATE INDEX "SetupFingerprint_symbol_timeframe_alreadyTraded_idx" ON "SetupFingerprint"("symbol", "timeframe", "alreadyTraded");

-- CreateIndex
CREATE INDEX "Cooldown_symbol_timeframe_active_idx" ON "Cooldown"("symbol", "timeframe", "active");

-- CreateIndex
CREATE INDEX "MarketSnapshot_symbol_snapshotAt_idx" ON "MarketSnapshot"("symbol", "snapshotAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_setupId_receivedAt_idx" ON "WebhookEvent"("setupId", "receivedAt");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
