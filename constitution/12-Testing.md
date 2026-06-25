# ITOS v1.0 — Testing

## Current State

No automated tests exist in ITOS v1.0. This is a known weakness documented in Architecture §Constraints. All validation is currently done through:
- Manual webhook test calls
- Visual dashboard inspection
- Railway deployment logs
- DB state inspection via Prisma queries

## Testing Debt Priority

The highest-risk areas without test coverage:

| Area | Risk | Priority |
|---|---|---|
| `riskEngine.ts` — gate logic | Silent failure could allow bad trades | P0 |
| `memoryEngine.ts` — fingerprint/cooldown | Wrong state could cause overtrading | P0 |
| `signalProvider.ts` — webhook validation | Security bypass if broken | P1 |
| `strategyEngine.ts` — EMA/ATR/regime | Wrong analysis drives wrong decisions | P1 |
| `tradeLifecycle.ts` — TP3 auto-close | Missed close leaves zombie trade | P1 |
| `stateBuilder.ts` — state assembly | Wrong dashboard state misleads trader | P2 |

## Test Strategy (to implement in Phase 2)

### Unit Tests
Framework: Vitest (compatible with Next.js 14, no Jest config needed)

Priority test files:
```
src/lib/__tests__/
  riskEngine.test.ts
  memoryEngine.test.ts
  signalProvider.test.ts
  strategyEngine.test.ts
  tradeLifecycle.test.ts
```

### Integration Tests
- Webhook endpoint: POST with valid/invalid secret, valid/invalid payload
- State endpoint: GET returns valid DashboardState shape
- Cron endpoint: GET with/without cron secret

Use an in-memory SQLite database or a Railway test service for integration tests.

### Key Test Cases — Risk Engine

```typescript
// Gate 1: Kill switch
test('rejects all signals when KILL_SWITCH=true')

// Gate 2: Grade gate
test('rejects ENTRY_TRIGGERED with grade=D')

// Gate 3: RR gate
test('rejects ENTRY_TRIGGERED with rr < 1.5')
test('allows ENTRY_TRIGGERED with rr = 1.5')

// Gate 4: Confidence gate
test('rejects ENTRY_TRIGGERED with confidence < 30')
```

### Key Test Cases — Memory Engine

```typescript
// Fingerprint uniqueness
test('same fingerprint ID returns existing record')
test('different fingerprint ID creates new record')
test('alreadyTraded=true blocks new entry')

// Cooldown
test('cooldown active blocks entry')
test('BAR_CLOSE decrements remainingBars')
test('remainingBars=0 sets active=false')

// Stale detection
test('range untouched 7+ days becomes STALE')
test('STALE range sets reentryAllowed=false')
```

### Key Test Cases — Signal Provider

```typescript
// Secret validation
test('correct secret returns true')
test('wrong secret returns false')
test('timing attack: wrong-length secret does not leak timing')

// Payload parsing
test('valid payload returns WebhookSignal')
test('missing symbol throws validation error')
test('invalid signal type throws validation error')
```

### Key Test Cases — Strategy Engine

```typescript
// Regime detection
test('EMA20 > EMA50 with upward slope = TRENDING_UP')
test('price oscillating within band = RANGING')

// Key levels
test('swing highs cluster within 0.5% tolerance')
test('returns empty array for insufficient bars')
```

## Manual Testing Protocol

Until automated tests are in place, use this protocol before every deploy:

### Pre-deploy checklist
- [ ] Run `npm run build` locally — no TypeScript errors
- [ ] Test webhook locally: `curl -X POST http://localhost:3000/api/webhook/tradingview?secret=... -d '{...}'`
- [ ] Check `/api/state` returns valid JSON with BTCUSDT
- [ ] Verify dashboard loads without console errors

### Post-deploy checklist
- [ ] Dashboard loads at Railway URL
- [ ] Price is current (not stale from DB)
- [ ] No error banners
- [ ] Regime shows a known value
- [ ] Key levels are populated

## Adding Vitest (Phase 2 setup)

```bash
npm install --save-dev vitest @vitest/ui
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

Add `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

## Test Coverage Target (Phase 2)

| Module | Target coverage |
|---|---|
| riskEngine.ts | 100% branch coverage |
| memoryEngine.ts | 90% |
| signalProvider.ts | 100% |
| strategyEngine.ts | 70% (complex math) |
| tradeLifecycle.ts | 80% |

Coverage tool: `@vitest/coverage-v8`
