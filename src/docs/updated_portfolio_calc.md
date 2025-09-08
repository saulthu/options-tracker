# Trading Ledger with Episodes (DB + Derived)

*(multi-user, multi-account, USD only, no crossings, running balance, realized P\&L, cash as episodes, option roll within 10h, same-right only)*

---

## 0) Why derived views?

* **DB stays minimal & auditable:** only immutable `transactions` (plus user/account/ticker reference data).
* **Speed & clarity:** build **LedgerRows** (statement with running balances) and **PositionEpisodes** (human-friendly bundles) **once** per request; reuse across UIs without re-parsing raw rows.
* **Deterministic, testable:** sort by `(timestamp ASC, id ASC)`, enforce rules in one place, get identical results on rebuilds.

---

## 1) Database schema (stored tables)

### 1.1) users (authentication and account management)

```yaml
users:
  id: string
  email: string
  name?: string
  created_at: datetime
  updated_at: datetime

constraints:
  - UNIQUE(email)
```

### 1.2) accounts (user's trading accounts)

```yaml
accounts:
  id: string
  user_id: string
  name: string
  type: string
  institution: string
  account_number?: string
  description?: string
  created_at: datetime

constraints:
  - UNIQUE(user_id, name)
```

### 1.3) tickers (financial instruments)

```yaml
tickers:
  id: string
  user_id: string
  name: string        # e.g. "AAPL", "MSFT"
  icon?: string

constraints:
  - UNIQUE(user_id, name)
```

> You may choose global/shared tickers instead of per-user; this spec assumes per-user for isolation.

### 1.4) transactions (immutable source of truth)

```yaml
transactions:
  id: string                    # UUID primary key
  user_id: string               # foreign key to users.id
  account_id: string            # foreign key to accounts.id
  timestamp: string             # broker event time (ISO8601)
  created_at: datetime          # record creation time
  updated_at: datetime          # last update time
  instrument_kind: string       # CASH | SHARES | CALL | PUT
  ticker_id?: string            # foreign key to tickers.id (required for SHARES/CALL/PUT)
  expiry?: string               # CALL/PUT only (YYYY-MM-DD)
  strike?: number               # CALL/PUT only (per share)
  side?: string                 # BUY | SELL (ignored for CASH)
  qty: number                   # CASH: signed cash movement; others: shares/contracts
  price?: number                # per share/contract (not used for CASH)
  fees: number                  # ≥ 0, all-in for the txn (commission + exchange)
  memo?: string                 # free text notes
```

**Conventions**

* **USD only** (no FX). Conversions are modeled as separate CASH deposit/withdrawal rows.
* **Options multiplier** = **100** (implicit; not stored).
* Economic immutability: do not rewrite history; corrections update `updated_at` for audit.

---

## 2) Derived identifiers (in memory)

* **InstrumentKey (per leg)**

  * CASH → `"CASH"`
  * SHARES → `"<TICKER>"`
  * OPTIONS → `"<TICKER>|<EXP>|<STRIKE>|<RIGHT>"` (e.g., `TSLA|2025-12-19|200|PUT`)

* **EpisodeKey (grouping episodes)**

  * CASH → `"CASH"`
  * SHARES → `"<TICKER>"`
  * OPTIONS → `"<TICKER>|<RIGHT>"`  ← **right-specific** (CALL and PUT never mix)

You’ll resolve `ticker_id` → `ticker_name` once up front via a lookup.

---

## 3) Derived views (not stored; rebuilt on demand)

These derived view structures are more suggestions than necessity and are more fluid than the database. Changing the database structures would be a pain and require a lot of migration, whereas these structures are rebuilt each time the program is opened, so it's okay to modify them and just update the code to use the new structures.

### 3.1) LedgerRow — statement+validation+running balances

```yaml
LedgerRow:
  txnId: string
  userId: string
  accountId: string
  timestamp: datetime
  instrumentKind: CASH | SHARES | CALL | PUT
  ticker?: string           # resolved from ticker_id
  expiry?: date
  strike?: number
  side?: BUY | SELL
  qty: number
  price?: number
  fees: number
  memo?: string

  cashDelta: number         # +/- cash effect of this txn
  balanceAfter: number      # account running balance after txn
  accepted: boolean         # false if rejected by rules
  error?: string
```

**Rules enforced here:**

* **SHARES long-only** (quantity cannot go negative).
* **No crossings** for SHARES/CALL/PUT (a single txn cannot push position through zero).
* Running **balance per account** for every accepted txn.

### 3.2) PositionEpisode — human-friendly holdings (with cash episodes)

```yaml
PositionEpisode:
  episodeId: string
  userId: string
  accountId: string
  episodeKey: string             # CASH | <TICKER> | <TICKER>|CALL | <TICKER>|PUT
  kindGroup: CASH | SHARES | OPTION

  # current leg snapshot (for quick display)
  currentInstrumentKey?: string  # e.g. "TSLA|2025-12-19|200|PUT"
  currentRight?: CALL | PUT
  currentExpiry?: date
  currentStrike?: number

  # lifecycle
  openTimestamp: datetime
  closeTimestamp?: datetime      # set when qty=0 (cash episodes close immediately)
  rolled: boolean                # true if roll happened within this episode

  # evolving economics
  qty: number                    # SHARES ≥ 0; OPTIONS may be ±; 0 at closed
  avgPrice: number               # per-unit entry average (fee-inclusive on opens/adds)
  totalFees: number
  cashTotal: number              # sum of cashDelta across episode (or cash value for cash episode)
  realizedPnLTotal: number

  txns: EpisodeTxn[]
```

```yaml
EpisodeTxn:
  txnId: string
  timestamp: datetime
  instrumentKind: CASH | SHARES | CALL | PUT
  ticker?: string
  expiry?: date
  strike?: number
  side?: BUY | SELL
  qty: number
  price?: number
  fees: number
  cashDelta: number
  realizedPnLDelta: number
  note?: string                 # "ROLL-CLOSE", "ROLL-OPEN", etc.
```

**Option roll (exception to “new episode after close”) — SAME RIGHT ONLY**

* A new option txn **reopens** the most recent **closed** option episode iff:

  * same `userId`, same `accountId`, same `ticker`, **same right** (CALL xor PUT),
  * **opposite side** vs the last txn of that closed episode,
  * **equal quantity** (contracts), and
  * within **10 hours** (`lastClose >= new.timestamp - 10h`).
* Reopen by:

  * setting `rolled=true`, clearing `closeTimestamp`,
  * resetting `qty=0, avgPrice=0` then applying the new leg (new expiry/strike OK),
  * tagging last close as `"ROLL-CLOSE"` and this new one as `"ROLL-OPEN"`.

---

## 4) What/Why/How (important implementation details)

* **Why cash episodes?** Uniform UI: every row is an episode; deposits/withdrawals are first-class.
* **Why episode snapshots?** `current*` fields let UIs show the present leg without inspecting `txns`.
* **Precision:** do internal math in decimal/float with 6–8 dp; **display** rounded (e.g., 2 dp). In the reference we round to 2 dp when emitting ledger cash deltas & balances and realized deltas for readability.
* **Ordering:** always sort by `(timestamp ASC, id ASC)` for determinism.
* **Ticker resolution:** join once: `ticker_lookup[ticker_id] -> "AAPL"`. Keep this stable for the build.

---

## 5) Example rows (minimal)

## 6) Reference implementation (Python, self-contained)

> Accepts DB-shaped dicts (transactions) and a `ticker_lookup` dict to resolve `ticker_id → ticker`. Produces `ledger`, `balances`, and `episodes` exactly as specified. Ready to test & port to TS.

```python
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta

# ----------------- helpers -----------------
def parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace('Z', '+00:00')) if ts.endswith('Z') else datetime.fromisoformat(ts)

def instrument_key(kind, ticker=None, expiry=None, strike=None):
    if kind == "CASH": return "CASH"
    if kind == "SHARES": return str(ticker)
    return f"{ticker}|{expiry}|{strike}|{kind}"  # option leg identity

def episode_key(kind, ticker=None):
    if kind == "CASH": return "CASH"
    if kind == "SHARES": return str(ticker)
    # options: group by ticker + right (CALL or PUT), never mixing rights
    return f"{ticker}|{kind}"

def is_option(kind): return kind in ("CALL","PUT")
def mult(kind): return 100 if is_option(kind) else 1
def sgn(x): return 1 if x>0 else -1 if x<0 else 0
def r2(x): return round(x + 1e-9, 2)

# ----------------- input (DB row → dict) -----------------
# Expect each transaction dict to contain:
#  id, user_id, account_id, timestamp, created_at, updated_at,
#  instrument_kind, ticker_id?, expiry?, strike?, side?, qty, price?, fees, memo?

# ----------------- pass 1: ledger -----------------
@dataclass
class LedgerRow:
    txnId: str
    userId: str
    accountId: str
    timestamp: str
    instrumentKind: str
    ticker: Optional[str]
    expiry: Optional[str]
    strike: Optional[float]
    side: Optional[str]
    qty: float
    price: Optional[float]
    fees: float
    memo: Optional[str]
    cashDelta: float
    balanceAfter: float
    accepted: bool
    error: Optional[str] = None

def build_ledger(transactions: List[Dict[str, Any]],
                 ticker_lookup: Dict[str, str],
                 opening_balances: Dict[str, float] | None = None) -> tuple[list[LedgerRow], dict[str, float]]:
    opening_balances = opening_balances or {}
    # stable sort
    txns = sorted(transactions, key=lambda t: (t["timestamp"], t["id"]))

    balances: Dict[str, float] = {}
    sizes: Dict[Tuple[str, str, str], float] = {}  # (user, account, instrumentKey) -> qty
    ledger: List[LedgerRow] = []

    for t in txns:
        user = t["user_id"]; acc = t["account_id"]
        balances.setdefault(acc, float(opening_balances.get(acc, 0.0)))
        kind = t["instrument_kind"]
        fees = float(t.get("fees", 0.0))

        # resolve ticker name for derived keys
        ticker = ticker_lookup.get(t.get("ticker_id", ""), None) if t.get("ticker_id") else None
        expiry = t.get("expiry")
        strike = t.get("strike")
        side = t.get("side")
        qty = float(t["qty"])
        price = float(t.get("price", 0.0)) if t.get("price") is not None else None

        if kind == "CASH":
            cash_delta = qty
            balances[acc] += cash_delta
            ledger.append(LedgerRow(
                txnId=t["id"], userId=user, accountId=acc, timestamp=t["timestamp"],
                instrumentKind=kind, ticker=None, expiry=None, strike=None,
                side=None, qty=qty, price=None, fees=fees, memo=t.get("memo"),
                cashDelta=r2(cash_delta), balanceAfter=r2(balances[acc]), accepted=True
            ))
            continue

        # trades
        assert side in ("BUY","SELL"), "side required for non-CASH"
        ikey = instrument_key(kind, ticker, expiry, strike)
        cur = float(sizes.get((user, acc, ikey), 0.0))

        direction = +1 if side == "BUY" else -1
        signed = direction * qty
        px = float(price or 0.0)

        # validations
        if kind == "SHARES" and cur + signed < 0:
            ledger.append(LedgerRow(
                txnId=t["id"], userId=user, accountId=acc, timestamp=t["timestamp"],
                instrumentKind=kind, ticker=ticker, expiry=expiry, strike=strike,
                side=side, qty=qty, price=price, fees=fees, memo=t.get("memo"),
                cashDelta=0.0, balanceAfter=r2(balances[acc]),
                accepted=False, error="Equities cannot be negative (long-only)"
            ))
            continue
        if cur != 0 and sgn(cur) != sgn(signed):
            rem = cur + signed
            if rem != 0 and sgn(rem) != sgn(cur):
                ledger.append(LedgerRow(
                    txnId=t["id"], userId=user, accountId=acc, timestamp=t["timestamp"],
                    instrumentKind=kind, ticker=ticker, expiry=expiry, strike=strike,
                    side=side, qty=qty, price=price, fees=fees, memo=t.get("memo"),
                    cashDelta=0.0, balanceAfter=r2(balances[acc]),
                    accepted=False, error="Crossing zero not allowed"
                ))
                continue

        # accepted: cash and size updates
        m = mult(kind)
        cash_delta = -(signed * px * m) - fees
        balances[acc] += cash_delta
        sizes[(user, acc, ikey)] = cur + signed

        ledger.append(LedgerRow(
            txnId=t["id"], userId=user, accountId=acc, timestamp=t["timestamp"],
            instrumentKind=kind, ticker=ticker, expiry=expiry, strike=strike,
            side=side, qty=qty, price=price, fees=fees, memo=t.get("memo"),
            cashDelta=r2(cash_delta), balanceAfter=r2(balances[acc]), accepted=True
        ))

    return ledger, balances

# ----------------- pass 2: episodes (cash episodes + option roll, same-right) -----------------
@dataclass
class EpisodeTxn:
    txnId: str; timestamp: str; instrumentKind: str; ticker: Optional[str]
    expiry: Optional[str]; strike: Optional[float]; side: Optional[str]; qty: float
    price: Optional[float]; fees: float; cashDelta: float; realizedPnLDelta: float; note: Optional[str]=None

@dataclass
class PositionEpisode:
    episodeId: str; userId: str; accountId: str; episodeKey: str; kindGroup: str
    currentInstrumentKey: Optional[str]=None; currentRight: Optional[str]=None
    currentExpiry: Optional[str]=None; currentStrike: Optional[float]=None
    openTimestamp: str=""; closeTimestamp: Optional[str]=None; rolled: bool=False
    qty: float=0.0; avgPrice: float=0.0; totalFees: float=0.0; cashTotal: float=0.0; realizedPnLTotal: float=0.0
    txns: List[EpisodeTxn]=field(default_factory=list)

def build_episodes(ledger: List[LedgerRow]) -> List[PositionEpisode]:
    accepted = [lr for lr in ledger if lr.accepted]
    accepted.sort(key=lambda r:(r.timestamp, r.txnId))
    episodes: List[PositionEpisode] = []
    active: Dict[Tuple[str,str,str], PositionEpisode] = {} # (user, account, episodeKey)
    closed_opt_idx: Dict[Tuple[str,str,str,str], PositionEpisode] = {} # (user, account, ticker, right)

    def cash_episode(lr: LedgerRow):
        ep = PositionEpisode(
            episodeId=f"{lr.userId}|{lr.accountId}|CASH|{lr.txnId}",
            userId=lr.userId, accountId=lr.accountId, episodeKey="CASH", kindGroup="CASH",
            openTimestamp=lr.timestamp, closeTimestamp=lr.timestamp,
            qty=float(lr.qty), avgPrice=0.0, totalFees=0.0,
            cashTotal=float(lr.cashDelta), realizedPnLTotal=0.0,
            txns=[EpisodeTxn(lr.txnId, lr.timestamp, "CASH", None, None, None, None, float(lr.qty),
                             None, 0.0, float(lr.cashDelta), 0.0)]
        )
        episodes.append(ep)

    def apply_trade(ep: PositionEpisode, lr: LedgerRow, opening=False, note: Optional[str]=None):
        right = lr.instrumentKind                           # CALL/PUT or SHARES
        m = mult(lr.instrumentKind)
        dirn = +1 if lr.side=="BUY" else -1
        signed = dirn * float(lr.qty)
        px = float(lr.price or 0.0)
        fees = float(lr.fees or 0.0)
        units = abs(float(lr.qty)) * m
        fee_per_unit = (fees/units) if units>0 else 0.0
        entry_unit_cost = px + fee_per_unit

        if is_option(lr.instrumentKind):
            ep.currentInstrumentKey = instrument_key(lr.instrumentKind, lr.ticker, lr.expiry, lr.strike)
            ep.currentRight = right
            ep.currentExpiry = lr.expiry
            ep.currentStrike = lr.strike

        realized = 0.0
        if ep.qty == 0 or (sgn(ep.qty)==sgn(signed) and abs(ep.qty+signed)>abs(ep.qty)):
            # open/add
            if ep.qty == 0:
                ep.avgPrice = entry_unit_cost
            else:
                base = abs(ep.qty)*m; add = abs(signed)*m
                ep.avgPrice = (base*ep.avgPrice + add*entry_unit_cost) / (base+add)
        else:
            # reduce
            closed = abs(signed)
            realized = ((px - ep.avgPrice) * closed * m - fees) if ep.qty>0 else ((ep.avgPrice - px) * closed * m - fees)
            ep.realizedPnLTotal += realized

        ep.qty += signed
        ep.totalFees += fees
        ep.cashTotal += float(lr.cashDelta)
        ep.txns.append(EpisodeTxn(
            lr.txnId, lr.timestamp, lr.instrumentKind, lr.ticker, lr.expiry, lr.strike,
            lr.side, float(lr.qty), lr.price, lr.fees, float(lr.cashDelta), r2(realized), note
        ))
        if ep.qty == 0:
            ep.avgPrice = 0.0
            ep.closeTimestamp = lr.timestamp

    def start_new_episode(lr: LedgerRow, note: Optional[str]=None) -> PositionEpisode:
        ek = episode_key(lr.instrumentKind, lr.ticker)
        kg = "OPTION" if is_option(lr.instrumentKind) else lr.instrumentKind
        ep = PositionEpisode(
            episodeId=f"{lr.userId}|{lr.accountId}|{ek}|{lr.txnId}",
            userId=lr.userId, accountId=lr.accountId, episodeKey=ek, kindGroup=kg, openTimestamp=lr.timestamp
        )
        apply_trade(ep, lr, opening=True, note=note)
        active[(lr.userId, lr.accountId, ek)] = ep
        episodes.append(ep)
        return ep

    def maybe_roll(lr: LedgerRow) -> Optional[PositionEpisode]:
        if not is_option(lr.instrumentKind): return None
        user, acc, ticker, right = lr.userId, lr.accountId, lr.ticker or "", lr.instrumentKind
        prev = closed_opt_idx.get((user, acc, ticker, right))
        if not prev or not prev.closeTimestamp: return None
        if parse_iso(prev.closeTimestamp) < parse_iso(lr.timestamp) - timedelta(hours=10):
            return None
        last = prev.txns[-1] if prev.txns else None
        if not last or last.side is None: return None
        if not ((last.side=="BUY" and lr.side=="SELL") or (last.side=="SELL" and lr.side=="BUY")):
            return None
        if abs(last.qty) != abs(float(lr.qty)):
            return None
        # re-open same episode (same right)
        prev.rolled = True
        prev.txns[-1].note = "ROLL-CLOSE"
        prev.closeTimestamp = None
        prev.qty = 0.0
        prev.avgPrice = 0.0
        apply_trade(prev, lr, opening=True, note="ROLL-OPEN")
        active[(user, acc, episode_key(right, ticker))] = prev
        closed_opt_idx.pop((user, acc, ticker, right), None)
        return prev

    for lr in accepted:
        if lr.instrumentKind == "CASH":
            cash_episode(lr)
            continue

        ek = episode_key(lr.instrumentKind, lr.ticker)
        key = (lr.userId, lr.accountId, ek)
        ep = active.get(key)

        if ep is None:
            rolled = maybe_roll(lr)
            if rolled is not None:
                continue
            ep = start_new_episode(lr)
        else:
            apply_trade(ep, lr)
            if ep.qty == 0:
                if is_option(lr.instrumentKind):
                    closed_opt_idx[(lr.userId, lr.accountId, lr.ticker or "", lr.instrumentKind)] = ep
                active.pop(key, None)

    return episodes

# ----------------- end-to-end -----------------
def build_positions_view(transactions: List[Dict[str, Any]],
                         ticker_lookup: Dict[str, str],
                         opening_balances: Optional[Dict[str, float]] = None):
    ledger, balances = build_ledger(transactions, ticker_lookup, opening_balances)
    episodes = build_episodes(ledger)
    episodes.sort(key=lambda e:(e.userId, e.accountId, e.episodeKey, e.openTimestamp))
    return {"ledger": ledger, "balances": balances, "episodes": episodes}

# ----------------- demo -----------------
if __name__ == "__main__":
    ticker_lookup = {"TK1": "AAPL", "TK2": "TSLA"}
    tx = [
        {"id":"t1","user_id":"U1","account_id":"AC1","timestamp":"2025-09-06T00:00:00Z","created_at":".","updated_at":".",
         "instrument_kind":"CASH","qty":10000,"fees":0,"memo":"Deposit"},
        {"id":"t2","user_id":"U1","account_id":"AC1","timestamp":"2025-09-06T00:05:00Z","created_at":".","updated_at":".",
         "instrument_kind":"SHARES","ticker_id":"TK1","side":"BUY","qty":100,"price":180,"fees":1},
        {"id":"t3","user_id":"U1","account_id":"AC1","timestamp":"2025-09-06T00:10:00Z","created_at":".","updated_at":".",
         "instrument_kind":"SHARES","ticker_id":"TK1","side":"SELL","qty":40,"price":190,"fees":1},
        {"id":"t4","user_id":"U1","account_id":"AC1","timestamp":"2025-09-06T01:00:00Z","created_at":".","updated_at":".",
         "instrument_kind":"PUT","ticker_id":"TK2","expiry":"2025-12-19","strike":200,"side":"SELL","qty":2,"price":3.00,"fees":0.70},
        {"id":"t5","user_id":"U1","account_id":"AC1","timestamp":"2025-09-06T02:00:00Z","created_at":".","updated_at":".",
         "instrument_kind":"PUT","ticker_id":"TK2","expiry":"2025-12-19","strike":200,"side":"BUY","qty":2,"price":2.00,"fees":0.70},
        {"id":"t6","user_id":"U1","account_id":"AC1","timestamp":"2025-09-06T03:00:00Z","created_at":".","updated_at":".",
         "instrument_kind":"PUT","ticker_id":"TK2","expiry":"2026-01-16","strike":220,"side":"SELL","qty":2,"price":1.40,"fees":0.60},
        {"id":"t7","user_id":"U1","account_id":"AC1","timestamp":"2025-09-06T04:00:00Z","created_at":".","updated_at":".",
         "instrument_kind":"CASH","qty":-500,"fees":0,"memo":"Withdrawal"},
    ]
    out = build_positions_view(tx, ticker_lookup, opening_balances={"AC1":0})
    print("Balances:", out["balances"])
    print("\nLedger:")
    for lr in out["ledger"]:
        print(asdict(lr))
    print("\nEpisodes:")
    for ep in out["episodes"]:
        d = asdict(ep); d["txns"] = [asdict(x) for x in ep.txns]; print(d)
```

---

### 7) Test checklist (quick)

* [ ] SHARES long-only rejection (SELL exceeds long).
* [ ] Options **no crossing** rejection in a single txn.
* [ ] Running balance per account matches cash deltas.
* [ ] Avg price includes **open/add** fee allocation; realized P\&L subtracts **closing** fees.
* [ ] Cash rows become **single-txn** episodes.
* [ ] Option **roll** merges only when (same account, **same ticker**, **same right**, opposite side, equal qty, within 10h).
* [ ] CALL and PUT **never** mix in one episode.

