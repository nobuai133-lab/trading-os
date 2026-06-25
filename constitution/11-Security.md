# ITOS v1.0 — Security

## Threat Model

ITOS is a paper trading system with no live execution in v1.0. The primary security concerns are:

1. **Unauthorized signal injection** — forged webhook causing a fake trade to be recorded
2. **Secret exposure** — credentials leaked via logs, code, or URLs
3. **Data integrity** — trade history tampered with
4. **Denial of service** — webhook endpoint flooded

The system does NOT handle real money in v1.0. Security posture is appropriate for a paper trading dashboard, not a financial institution.

## Webhook Security

### Secret Validation
All webhook requests require a `?secret=` query parameter matching `WEBHOOK_SECRET` env var.

Implementation uses `crypto.timingSafeEqual` to prevent timing attacks:
```typescript
function validateWebhookSecret(provided: string): boolean {
  const expected = process.env.WEBHOOK_SECRET ?? '';
  if (!provided || provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(provided),
    Buffer.from(expected)
  );
}
```

**Known limitation:** The secret appears in the TradingView alert URL as a query parameter. This means:
- It is visible in server access logs
- It is visible in TradingView alert settings
- It is NOT transmitted as a header (TradingView limitation)

Mitigation: Use a long, high-entropy secret (32+ hex chars). Rotate if logs are compromised.

### Webhook Deduplication
`isDuplicateWebhook(setupId, windowMs)` checks for duplicate signals within a 60-second window. This prevents TradingView from double-firing a signal from causing duplicate trades.

## Secrets Management

### Rules
- No secrets in source code — ever
- No secrets in committed `.env` files
- No secrets in Railway build logs (use dummy value for build-time vars)
- No secrets in webhook response bodies

### Where Secrets Live
- Railway Environment Variables (runtime)
- `nixpacks.toml` [variables] only contains a dummy `DATABASE_URL` for build validation

### Secret Rotation
When rotating `WEBHOOK_SECRET`:
1. Update Railway Environment Variable
2. Update TradingView alert URL with new secret
3. Old secret immediately invalid — test new webhook before closing the old alert

## API Endpoint Security

| Endpoint | Auth | Exposure |
|---|---|---|
| `POST /api/webhook/tradingview` | `?secret=` query param | TradingView only |
| `GET /api/state` | None | Public (acceptable: paper data) |
| `GET /api/trades` | None | Public (acceptable: paper data) |
| `GET /api/cron/market-scan` | `x-cron-secret` header | Internal/cron |
| `GET /api/cron/historical-scan` | `x-cron-secret` header | Internal/one-time |

`/api/state` and `/api/trades` have no authentication by design — they contain paper trading data with no financial risk. This is acceptable for v1.0 but should be gated behind auth before any live execution.

## Database Security

- `DATABASE_URL` uses Railway's internal private network (`postgres.railway.internal`) — not accessible from the public internet
- Public proxy URL (`reseau.proxy.rlwy.net`) is available for local dev only — should not be committed
- Prisma ORM prevents SQL injection by construction (parameterized queries)

## Input Validation

All webhook payloads are parsed through `parseWebhookPayload()`:
- Required fields: `symbol`, `signal`
- Signal type validated against allowed enum
- Numeric fields: coerced to Number, NaN-checked
- No eval, no dynamic SQL, no shell execution from webhook data

## No Live Execution Security

The risk engine enforces PAPER_TRADING mode in code. To enable live execution, a code change is required — an environment variable change alone is not sufficient (by architectural design).

This prevents accidental live trading from a misconfigured Railway variable.

## Logging and Audit

Security-relevant events logged to DB (WebhookEvent, Notification tables):
- Every webhook received (with payload, timestamp, IP)
- Every signal rejected (with reason)
- Every kill switch activation
- Every error from trade processing

Logs do NOT contain:
- `WEBHOOK_SECRET` value
- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`

## Recommended Phase 2 Security Additions

- Add IP allowlist for TradingView webhook IPs (known ranges)
- Add rate limiting on `/api/webhook/tradingview` (max 10 req/min)
- Add authentication on `/api/state` before live mode consideration
- Rotate all secrets before enabling LIVE trading mode
- Add audit log for manual DB changes (via DECISION_LOG.md requirement)
