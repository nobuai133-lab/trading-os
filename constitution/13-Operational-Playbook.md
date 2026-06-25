# ITOS v1.0 — Operational Playbook

## Daily Routine

### Morning Check (before market open)
1. Open dashboard: https://trading-os-production-6354.up.railway.app
2. Confirm price is live (not stale)
3. Check regime on 4H and 1D
4. Review key levels — note proximity to current price
5. Check anti-reentry panel — any cooldowns active?
6. Check Telegram — any overnight alerts?

If system is IDLE and no cooldown: ready to receive setup signals.

### Signal Received (SETUP_DETECTED)
1. Telegram notification fires with setup details
2. Dashboard switches to `SETUP_DETECTED` mode
3. Review Scanner + Key Levels + Risk panels
4. Check: Is this a grade A or B setup?
5. Check: Is HTF bias aligned with direction?
6. Check: Is entry zone near a key level?
7. Decision: Approve setup in TradingView → alert will send `ENTRY_TRIGGERED` if price reaches zone

### Trade Active (ACTIVE_TRADE)
1. Dashboard shows open trade with unrealized R
2. Monitor TP1, TP2, TP3 hit notifications via Telegram
3. Optional: Manually trail SL by sending `BAR_CLOSE` signal update
4. When trade closes (TP3/SL): record lesson/mistake notes in DB or DECISION_LOG

### After TP3 (Cooldown)
1. Telegram: TP3 hit notification
2. Dashboard: mode switches to `COOLDOWN`
3. Cooldown runs 4 bars (4H) — no new entries allowed
4. Use cooldown period to review: what worked, what didn't
5. After cooldown: mode returns to IDLE, fresh setup required

## Weekly Routine

- Review all closed trades from the past week
- Calculate running equity curve manually from Trade table
- Check drawdown vs 20% limit
- Update CHANGELOG.md with key events
- Check key levels are still valid (manual TradingView review)
- Run historical scan if needed: `GET /api/cron/historical-scan`

## Common Operations

### Reset Kill Switch
```
Railway → Variables → KILL_SWITCH → set to false
```
Then send a test signal to confirm webhook is accepting signals.

### Force-Close a Trade
Send via curl or webhook tester:
```json
{
  "symbol": "BTCUSDT",
  "signal": "CLOSE_TRADE",
  "direction": "LONG"
}
```
URL: `https://trading-os-production-6354.up.railway.app/api/webhook/tradingview?secret=<WEBHOOK_SECRET>`

### Manually Clear Cooldown
Direct DB update (use carefully):
```sql
UPDATE "Cooldown" SET active = false, "remainingBars" = 0 WHERE active = true;
```
Document in DECISION_LOG.md with reason.

### Reset Stale Range
Direct DB update:
```sql
UPDATE "RangeMemory" SET status = 'ACTIVE', "reentryAllowed" = true, "freshLiquidity" = true 
WHERE status = 'STALE' AND symbol = 'BTCUSDT';
```
Only do this after confirming new structure has formed. Document in DECISION_LOG.md.

### Trigger Manual Market Scan
```
curl -H "x-cron-secret: <CRON_SECRET>" \
  https://trading-os-production-6354.up.railway.app/api/cron/market-scan
```

### Check DB State (Railway CLI)
```
railway connect postgres
\c railway
SELECT * FROM "Trade" ORDER BY "createdAt" DESC LIMIT 5;
SELECT * FROM "Cooldown" WHERE active = true;
SELECT * FROM "RangeMemory" WHERE status = 'STALE';
```

## Incident Response

### Scenario: Dashboard shows wrong price
1. Check `/api/state` directly — is price field stale?
2. Check Kraken API is accessible: `curl https://api.kraken.com/0/public/Ticker?pair=XBTUSDT`
3. If Kraken is down: dashboard shows last DB snapshot price — this is expected behavior
4. If Kraken is up but price is wrong: check `marketData.ts` symbol mapping

### Scenario: Trade opened but should not have been
1. Activate kill switch immediately: Railway → KILL_SWITCH=true
2. Set trade status manually: `UPDATE "Trade" SET status = 'CLOSED_MANUAL' WHERE id = '<id>'`
3. Review WebhookEvent table: which signal caused the entry?
4. Identify root cause: TradingView alert misconfiguration? Replay?
5. Fix and document in DECISION_LOG.md before clearing kill switch

### Scenario: Webhook not receiving signals
1. Check Railway logs: `railway logs --tail`
2. Test webhook manually with curl
3. Verify TradingView alert is pointing to correct URL with correct secret
4. Check `WEBHOOK_SECRET` env var matches TradingView alert URL

### Scenario: Database connection failure
1. Check Railway PostgreSQL plugin is running (Railway dashboard)
2. Verify `DATABASE_URL` is set and points to internal URL
3. Run `npx prisma migrate deploy` manually via Railway CLI if schema is out of sync

## Escalation Checklist

Before enabling LIVE trading mode:
- [ ] 50+ documented paper trades
- [ ] 3+ months continuous paper operation
- [ ] Drawdown < 20% over full period
- [ ] Profit factor ≥ 1.3
- [ ] Decision documented in DECISION_LOG.md
- [ ] Code change to `TRADING_MODE=LIVE` with governance reference in commit message
- [ ] Test LIVE mode on a $10 minimum size before scaling
