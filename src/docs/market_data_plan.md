# Market Data Caching & API Plan

**Last updated:** 2025-09-15

**Updates:**
* Simplified draft for implementation (aligned to per‑option key caching)

---

## 0) Goals

* Clean, self‑contained TypeScript module ("MarketData").
* In‑memory + DB caching to minimize vendor calls.
* Store a single JSON blob per ticker in `tickers.market_data` with **≤200 candles** per timeframe.
* Compute SMA/EMA on demand (not persisted).
* Options: cache **multiple** entries per ticker, **keyed by (expiry,strike)**, storing only the **latest** value for each key; automatically prune old options based on expiry age during DB serialization.
* Simple, low‑chatter DB write model: single queued write persists the latest state.

---

## 1) High‑Level Architecture

```
[UI/Features]
     │
     ▼
[MarketData API (TS)] → In-memory cache → [DB: tickers.market_data JSON]
     │
     └────────────── fallback to vendor APIs (when needed)
```

* **In‑Memory Cache**: Parsed candles and an options map keyed by `(expiry,strike)` for fast reuse.
* **DB Cache**: Durable JSON blob per ticker with candles and options entries.
* **Vendor**: Used only if cache missing or stale.

---

## 2) Public API

### 2.1 Types (simplified)

* `Ticker = string`
* `Timeframe = '1D' | '1W'`
* `Candle = { t: string, o: number, h: number, l: number, c: number, v?: number }`
* `OptionKey = { expiry: string /* ISO date */, strike: number }`
* `OptionQuote = { bid?: number, ask?: number, last?: number, iv?: number, delta?: number, gamma?: number, theta?: number, vega?: number, volume?: number, openInterest?: number }`
* `OptionsEntry = { asOf: string, expiry: string, strike: number, call?: OptionQuote, put?: OptionQuote, spot: number }`
* `MarketDataBlob` – see §3

### 2.2 Methods

* `getCandles(ticker: Ticker, timeframe: Timeframe, opts?: { forceRefresh?: boolean }): Promise<Candle[]>`

  * Returns ≤200 candles; memory ➜ DB ➜ vendor.
* `getIndicator(ticker: Ticker, indicator: 'SMA' | 'EMA', params: { window: number }, timeframe: Timeframe): Promise<number[]>`

  * Computes from `getCandles(...)`.
* `getOption(ticker: Ticker, key: OptionKey, opts?: { forceRefresh?: boolean }): Promise<OptionsEntry>`

  * Returns the **specific** (expiry,strike) entry; maintains only the latest value per key.
* `listOptionKeys(ticker: Ticker): Promise<OptionKey[]>`

  * Returns all currently cached option keys for a ticker (after pruning).
* `primeFromDB(tickers: Ticker[]): Promise<void>`

  * Hydrates memory cache for initial page load.

---

## 3) DB Schema & Blob Shape

### 3.1 Table

```
Table: tickers
- id: uuid (PK)
- symbol: text (unique)
- market_data: jsonb NULL
- updated_at: timestamptz
```

### 3.2 `market_data` JSON

```jsonc
{
  "schemaVersion": 1,
  "asOf": "2025-09-15T08:15:00Z",
  "candles": {
    "1D": { "series": [ /* ≤200 */ ], "lastUpdated": "2025-09-15T08:15:00Z" },
    "1W": { "series": [ /* ≤200 */ ], "lastUpdated": "2025-09-12T00:00:00Z" }
  },
  "options": {
    "lastUpdated": "2025-09-15T08:12:00Z",
    "entries": {
      "2025-09-20@120": { "asOf": "2025-09-15T08:10:00Z", "expiry": "2025-09-20", "strike": 120, "call": {"bid":2.5,"ask":2.7}, "spot": 123.45 },
      "2025-10-18@150": { "asOf": "2025-09-15T08:11:00Z", "expiry": "2025-10-18", "strike": 150, "put":  {"bid":1.3,"ask":1.4}, "spot": 123.45 }
    }
  }
}
```

**Rules**

* Candle series trimmed to ≤200 **before** persist.
* Options are stored as a **map** `entries["<expiry>@<strike>"] = OptionsEntry`.
* Each key holds **only the latest** fetched entry for that (expiry,strike).

---

## 4) Freshness & Expiration

* `1D` candles: fresh ≤ 1 min (market hours), else ≤ 30 min.
* `1W` candles: fresh ≤ 24h.
* Options (per entry): fresh ≤ 5 min (market hours), else ≤ 60 min.

If stale: serve cached immediately and trigger background refresh. Missing/over‑TTL: fetch before return (with a reasonable timeout) or return a typed stale marker if configured.

---

## 5) Options Pruning (Expiry‑Age Based)

* **Retention window**: `optionsRetentionDays` (default **7 days**) *after the option expiry date*.
* **Pruning moment**: During **write‑to‑DB serialization** (and optionally on `primeFromDB` load), drop any option entries where `now > (expiry + optionsRetentionDays)`. This keeps memory and blobs small.
* Pruning only removes expired/aged entries; current/future expiries remain.

---

## 6) Persistence Policy (Single Queued Write)

* If local in‑memory data changes (candles or any options entry), **queue a DB write**.
* If a write is already queued, **do not** queue another.
* When the write executes:

  1. **Serialize current in‑memory state** (not an older snapshot).
  2. **Trim** candle series to ≤200.
  3. **Prune** options by expiry + retention window (§5).
  4. Persist to `tickers.market_data` and update `updated_at`.

This guarantees one up‑to‑date snapshot with minimal DB chatter.

---

## 7) Initialization & Integration

* On startup, `primeFromDB(tickers)` to hydrate cache.
* UI/feature code calls `getCandles`, `getIndicator`, `getOption`, `listOptionKeys` directly.
* API secrets are provided to this module at init (constructor/config), not hardcoded.

---

## 8) Testing Plan

* **Unit**: candle trimming; SMA/EMA math; freshness logic per resource; queued write behavior; options pruning (boundary cases around `expiry + N days`).
* **Integration**: prime ➜ serve ➜ refresh ➜ serialize (with prune) ➜ persist; concurrent calls share results.

---

## 9) Config

* `optionsRetentionDays` (default 7).
* Freshness windows for candles/options.

---

## 10) Acceptance Criteria

* Per‑option key caching works: only latest value per (expiry,strike) retained.
* Pruning removes entries older than `expiry + optionsRetentionDays` during DB writes.
* No duplicate DB writes while a write is queued.
* ≤200 candles always enforced.
* Module independent, easy to test and integrate.
