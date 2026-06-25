# ITOS v1.0 — Philosophy

## 15 Master Principles

### 1. Risk-First, Not Signal-First
Every decision begins with "what is the maximum I can lose?" before "what can I gain?" No signal is evaluated without a defined SL and RR.

### 2. Evidence-Based, Not Prediction-Based
ITOS does not predict price. It identifies structural conditions where historical evidence supports a high-probability outcome. Every entry requires documented evidence.

### 3. Event-Driven, Not Unnecessary Polling
Processing happens on events (webhook signals, bar closes). Background polling is minimized to market snapshots every 15 minutes. State is cached and served from DB — not recomputed on every request.

### 4. Cloud-Native, Not Desktop-Dependent
Production systems must not depend on TradingView Desktop, CDP, or any local process. All market data flows through API. TradingView MCP is a local analysis tool only.

### 5. Modular Engines, Not Monolithic Logic
Each concern is a separate engine:
- Market Data Engine
- Strategy Engine
- Memory Engine
- Risk Engine
- Trade Lifecycle Engine
- Notification Engine
- State Builder

Engines communicate through well-defined interfaces. No engine imports another engine's DB logic directly.

### 6. Auditable Decisions
Every signal received, every decision made, every trade opened or blocked — is logged to the database with full context. Nothing happens silently.

### 7. Paper Trading Before Live Trading
Default mode is PAPER_TRADING. Live execution is disabled in code until explicitly enabled after governance review. A 3-month paper trading track record is required before live consideration.

### 8. Single Source of Truth for Market Data
One market data provider is active at a time. Currently: Kraken. Provider is configurable via environment variable. No mixing of data from different providers in the same analysis.

### 9. No Overtrading
One active trade at a time per symbol. Setup fingerprinting prevents re-entering the same structural setup. Range memory prevents same-range re-entry without fresh liquidity.

### 10. No Repeated Stale Setup
A setup that has already been traded or is in a stale range is blocked at the memory engine level. The system remembers every trade it has considered.

### 11. No Same-Range Re-Entry Without Fresh Liquidity
After a trade in a range, re-entry requires: fresh liquidity sweep confirmation, range reset, and fingerprint clearance.

### 12. TP3 Means Trade Completed and Bias Reset
Reaching TP3 is a full trade completion. The system enters a mandatory cooldown. The bias is reset. No continuation trades are allowed until cooldown expires and new structure forms.

### 13. LLM Must Be Used Selectively
Claude/LLM analysis is triggered only on high-confidence, high-grade setups. Deterministic engines handle all repetitive checks. LLM cost is controlled by gates: minimum grade B, minimum confidence 60%, not in cooldown.

### 14. Deterministic Engines for Repetitive Checks
EMA, ATR, regime detection, fingerprint lookup, cooldown check, RR calculation — these are deterministic code, not LLM calls. LLM adds qualitative judgment, not quantitative computation.

### 15. Every Strategy Must Pass Backtest and Paper Trading Governance
No strategy enters production without: documented backtest results (min 50 trades, positive expectancy, max DD < 20%), and 30-day paper trading with at least 10 documented trades matching the backtest edge.
