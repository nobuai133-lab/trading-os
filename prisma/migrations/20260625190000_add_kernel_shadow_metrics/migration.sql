-- Migration: add_kernel_shadow_metrics
-- Adds KernelMetrics (singleton accumulator) and KernelDivergenceLog
-- for Phase 3.5 Stage 2.5 Shadow Production Verification.

CREATE TABLE "KernelMetrics" (
    "id"                   INTEGER           NOT NULL,
    "totalWebhookEvents"   INTEGER           NOT NULL DEFAULT 0,
    "totalKernelEvents"    INTEGER           NOT NULL DEFAULT 0,
    "kernelTransitions"    INTEGER           NOT NULL DEFAULT 0,
    "criticalDivergences"  INTEGER           NOT NULL DEFAULT 0,
    "warningDivergences"   INTEGER           NOT NULL DEFAULT 0,
    "infoDivergences"      INTEGER           NOT NULL DEFAULT 0,
    "snapshotCount"        INTEGER           NOT NULL DEFAULT 0,
    "totalLatencyMs"       DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "latencySamples"       INTEGER           NOT NULL DEFAULT 0,
    "lastLatencyMs"        DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "lastSnapshotSeq"      BIGINT,
    "firstEventAt"         TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEventAt"          TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KernelMetrics_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row immediately
INSERT INTO "KernelMetrics" ("id", "updatedAt")
VALUES (1, NOW())
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "KernelDivergenceLog" (
    "id"                SERIAL       NOT NULL,
    "ts"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity"          TEXT         NOT NULL,
    "correlationId"     TEXT         NOT NULL,
    "kernelMode"        TEXT         NOT NULL,
    "systemMode"        TEXT         NOT NULL,
    "kernelTradePhase"  TEXT,
    "systemTradeStatus" TEXT,
    "kernelTradeActive" BOOLEAN      NOT NULL,
    "systemTradeActive" BOOLEAN      NOT NULL,
    "detail"            JSONB        NOT NULL DEFAULT '{}',
    CONSTRAINT "KernelDivergenceLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KernelDivergenceLog_severity_ts_idx"      ON "KernelDivergenceLog"("severity", "ts");
CREATE INDEX "KernelDivergenceLog_correlationId_idx"    ON "KernelDivergenceLog"("correlationId");
