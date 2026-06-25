-- Migration: add_kernel_event_snapshot
-- Adds KernelEvent and KernelSnapshot tables for Phase 3.5 Core State Kernel.
-- Append-only tables — never updated or deleted.

CREATE TABLE "KernelEvent" (
    "id"            TEXT        NOT NULL,
    "seq"           BIGINT      NOT NULL,
    "previousSeq"   BIGINT      NOT NULL,
    "ts"            TIMESTAMP(3) NOT NULL,
    "correlationId" TEXT        NOT NULL,
    "sessionId"     TEXT        NOT NULL,
    "source"        TEXT        NOT NULL,
    "domain"        TEXT        NOT NULL,
    "type"          TEXT        NOT NULL,
    "version"       INTEGER     NOT NULL DEFAULT 1,
    "tradeId"       TEXT,
    "setupId"       TEXT,
    "payload"       JSONB       NOT NULL DEFAULT '{}',

    CONSTRAINT "KernelEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KernelEvent_seq_key" ON "KernelEvent"("seq");
CREATE INDEX "KernelEvent_correlationId_idx" ON "KernelEvent"("correlationId");
CREATE INDEX "KernelEvent_domain_type_idx" ON "KernelEvent"("domain", "type");
CREATE INDEX "KernelEvent_tradeId_idx" ON "KernelEvent"("tradeId");

CREATE TABLE "KernelSnapshot" (
    "id"         TEXT        NOT NULL,
    "seq"        BIGINT      NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL,
    "eventCount" INTEGER     NOT NULL,
    "state"      JSONB       NOT NULL,

    CONSTRAINT "KernelSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KernelSnapshot_seq_key" ON "KernelSnapshot"("seq");
CREATE INDEX "KernelSnapshot_seq_idx" ON "KernelSnapshot"("seq");
