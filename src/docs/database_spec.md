# Trading Ledger Schema

*(multi-account, no FX, no crossings, running balance, realized P\&L)*

---

## Core Principle

* The **primary database tables** are **`users`**, **`accounts`**, **`tickers`**, and **`transactions`**.
* All other objects (**Positions**, **CashBalances**, **LedgerRows**, **RealizedEvents**) are **derived in memory** by scanning the immutable transaction log (optionally cached/snapshotted for speed).

---

## 1) users (authentication and account management)

```yaml
users:
  id: string                    # UUID primary key
  email: string                 # unique email address
  name?: string                 # display name
  created_at: datetime          # account creation time
  updated_at: datetime          # last profile update
```

---

## 2) accounts (user's trading accounts)

```yaml
accounts:
  id: string                    # UUID primary key
  user_id: string               # foreign key to users.id
  name: string                  # account display name (unique per user)
  type: string                  # account type (Individual, IRA, etc.)
  institution: string           # broker/institution name
  account_number?: string       # broker account number
  description?: string          # optional description
  created_at: datetime          # account creation time

constraints:
  - UNIQUE(user_id, name)       # account names must be unique per user
```

---

## 3) tickers (financial instruments)

```yaml
tickers:
  id: string                    # UUID primary key
  user_id: string               # foreign key to users.id
  name: string                  # ticker symbol (AAPL, MSFT, etc.)
  icon?: string                 # path/URL to cached icon file
```

---

## 4) transactions (immutable source of truth)

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

* **No FX**: currency conversions are modeled as CASH deposits/withdrawals.
* **Options multiplier** is implicitly **100** (not stored).
* Transactions are economically **immutable**; audit with `created_at` / `updated_at`.

---

## 5) Table Relationships

* Each transaction belongs to exactly one user (`user_id` foreign key)
* Users can have multiple accounts (`account_id` for grouping transactions)
* For single-account users, `account_id` typically equals `user_id`
* All portfolio calculations are scoped to a specific user

---

## 6) Instrument key (canonical identity)

* **CASH** → `CASH`
* **SHARES** → `ticker`
* **CALL/PUT** → `ticker|expiry|strike|CALL/PUT`
  Use `(account_id, instrumentKey)` to group state.

---

## 7) Derived views (in memory)

### 7.1 Positions (open holdings "now")

```yaml
Position:
  account_id: string
  instrumentKey: string
  instrument_kind: SHARES | CALL | PUT
  ticker: string
  qty: number                  # SHARES ≥ 0; CALL/PUT may be >0 (long) or <0 (short)
  avgPrice: number             # weighted average ENTRY cost per unit (includes allocated open-side fees)
  expiry?: date
  strike?: number
  coverageHint?: COVERED | CASH_SECURED | NAKED   # optional, computed on open/add
```

### 7.2 Cash balances (per account, running)

```yaml
CashBalance:
  account_id: string
  balance: number
```

### 7.3 Ledger with running balance (per txn)

```yaml
LedgerRow:
  txn_id: string
  account_id: string
  timestamp: datetime
  instrument_kind: CASH | SHARES | CALL | PUT
  ticker?: string
  expiry?: date
  strike?: number
  side?: BUY | SELL
  qty: number
  price?: number
  fees: number
  memo?: string

  cashDelta: number            # +/− cash effect of this txn
  balanceAfter: number         # account's running balance AFTER applying this txn
  accepted: boolean            # false if rejected by validation (no effect on balance/positions)
  error?: string               # rejection reason
```

### 7.4 Realized P\&L events (on each close or partial close)

Emitted **only when quantity is reduced toward zero** on an existing side.

```yaml
RealizedEvent:
  account_id: string
  timestamp: datetime          # closing txn's timestamp
  instrumentKey: string
  instrument_kind: SHARES | CALL | PUT
  ticker: string
  closedQty: number            # absolute units closed in this event (shares or contracts)
  closePrice: number           # per unit
  openAvgPrice: number         # per unit, BEFORE close
  multiplier: number           # 1 for SHARES, 100 for options (explicit for clarity)
  closeFees: number            # fees charged on this closing txn
  realizedPnL: number          # (closePrice - openAvgPrice) * closedQty * multiplier - closeFees
  coverageAtOpen?: COVERED | CASH_SECURED | NAKED
  memo?: string
```

> **Design:** `avgPrice` **includes allocated open-side fees**; realized P\&L subtracts **only closing fees**. No lot storage required.

---

## 8) Rules & invariants

**Multi-account:** derive state independently per `account_id`.

**Ordering & determinism**

* Sort transactions by `(timestamp ASC, id ASC)` to break ties deterministically.

**No crossings**

* **SHARES** are **long-only** → `qty` must not go negative.
* **CALL/PUT** may be long (>0) or short (<0), but **a single transaction may not cross zero**. Crossing attempts are **rejected** (`accepted=false`), leaving positions and balances unchanged.

**Average price (open-side)**

* **Open from flat:** `avgPrice = entryPrice + (openFees / unitsOpened)`.
* **Add to same side:** weighted average using fee-inclusive unit cost for the add.
* **Partial close:** reduce quantity; `avgPrice` unchanged; emit `RealizedEvent`.
* **Full close:** quantity → 0; `avgPrice → 0`; emit `RealizedEvent` for the closed amount.

**Coverage hints (optional)**

* **Covered call:** when opening/adding a short CALL, if concurrent SHARES qty ≥ `contracts * 100`, set `coverageHint=COVERED`; else `NAKED`.
* **Cash-secured put:** when opening/adding a short PUT, if current cash balance ≥ `strike * 100 * contracts`, set `coverageHint=CASH_SECURED`; else `NAKED`. (Advisory only—doesn’t block.)

**Cash mechanics (applied only if txn accepted)**

* **CASH:** `cashDelta = qty`.
* **SHARES:** BUY → `-(price*qty) - fees`; SELL → `+(price*qty) - fees`.
* **OPTIONS:** same formulas ×**100** multiplier.

**Precision & rounding**

* Use decimal math; recommend rounding displayed monetary values to 2–4 decimals, but keep internal precision higher (e.g., 6–8 decimals) to avoid drift.

---

## 9) Micro-examples

**Close part of a long shares position**

* Open: BUY 100 @ 10.00, fees 1.00

  * Units = 100; open fee per unit = 0.01 → `avgPrice = 10.01`
* Close: SELL 40 @ 12.00, fees 1.00

  * Realized = `(12.00 − 10.01) * 40 * 1 − 1.00 = 79.60 − 1.00 = 78.60`

**Close part of a short put**

* Open: SELL 2 × 200P @ 3.00, fees 0.70

  * Units = 2\*100=200; fee per unit = 0.70/200 = 0.0035 → `avgPrice ≈ 3.0035`
* Close: BUY 1 @ 2.10, fees 0.70

  * Realized = `(3.0035 − 2.10) * 1 * 100 − 0.70 ≈ 90.35 − 0.70 = 89.65`

---

## 10) Builder example (derivation logic, high-level)

Here’s a **simple, self-contained Python** version of the builder that follows your spec: multi-account, no FX logic, **no crossings**, running balance per txn, Positions in memory, and **Realized P\&L events** on (partial/full) closes. It uses plain dicts/lists for simplicity.

```python
from typing import Dict, List, Tuple, Any
from math import copysign

# -----------------------------
# Helpers
# -----------------------------

def instrument_key(kind: str, ticker: str = None, expiry: str = None, strike: float = None) -> str:
    if kind == "CASH":
        return "CASH"
    if kind == "SHARES":
        return str(ticker)
    # CALL / PUT
    return f"{ticker}|{expiry}|{strike}|{kind}"

def is_option(kind: str) -> bool:
    return kind in ("CALL", "PUT")

def multiplier_for(kind: str) -> int:
    return 100 if is_option(kind) else 1

def sign(x: float) -> int:
    if x > 0: return 1
    if x < 0: return -1
    return 0

def shares_qty(positions: Dict[Tuple[str, str], Dict[str, Any]], account_id: str, ticker: str) -> int:
    """Return current open SHARES qty for (account, ticker)."""
    key = (account_id, instrument_key("SHARES", ticker=ticker))
    pos = positions.get(key)
    return int(pos["qty"]) if pos else 0

# -----------------------------
# Core builder
# -----------------------------

def build_portfolio(
    transactions: List[Dict[str, Any]],
    opening_balances: Dict[str, float] = None,
) -> Dict[str, Any]:
    """
    Inputs:
      - transactions: list of dicts with fields per your transactions schema.
      - opening_balances: optional {account_id: openingCashBalance}.

    Returns dict with:
      - positions: {(account_id, instrumentKey) -> {qty, avgPrice, instrument_kind, ticker, expiry, strike, coverageHint?}}
      - balances:  {account_id -> final cash balance}
      - ledger:    list of per-txn rows including cashDelta, balanceAfter, accepted, error?
      - realized:  list of realized P&L events (on partial/full closes)
    """
    opening_balances = opening_balances or {}

    # Sort deterministically by (timestamp ASC, id ASC)
    sorted_txns = sorted(transactions, key=lambda t: (t.get("timestamp", ""), t.get("id", "")))

    balances: Dict[str, float] = {}
    positions: Dict[Tuple[str, str], Dict[str, Any]] = {}
    ledger: List[Dict[str, Any]] = []
    realized: List[Dict[str, Any]] = []

    for t in sorted_txns:
        acc = t["account_id"]
        balances.setdefault(acc, float(opening_balances.get(acc, 0.0)))

        kind = t["instrument_kind"]
        fees = float(t.get("fees", 0.0))
        memo = t.get("memo")

        row_base = {
            "txn_id": t["id"],
            "account_id": acc,
            "timestamp": t.get("timestamp"),
            "instrument_kind": kind,
            "ticker": t.get("ticker"),
            "expiry": t.get("expiry"),
            "strike": t.get("strike"),
            "side": t.get("side"),
            "qty": t.get("qty"),
            "price": t.get("price"),
            "fees": fees,
            "memo": memo,
        }

        # ---------------- CASH ----------------
        if kind == "CASH":
            cash_delta = float(t["qty"])
            balances[acc] += cash_delta
            ledger.append({**row_base, "cashDelta": cash_delta, "balanceAfter": balances[acc], "accepted": True})
            continue

        # ---------------- TRADES (SHARES / CALL / PUT) ----------------
        ticker = t["ticker"]
        expiry = t.get("expiry")
        strike = t.get("strike")
        price = float(t.get("price", 0.0))
        side = t["side"]  # required for non-CASH
        qty_raw = float(t["qty"])

        key_str = instrument_key(kind, ticker, expiry, strike)
        key = (acc, key_str)

        pos = positions.get(key, {
            "qty": 0.0,
            "avgPrice": 0.0,
            "instrument_kind": kind,
            "ticker": ticker,
            "expiry": expiry,
            "strike": strike,
            # "coverageHint": None  # set on open/add if desired
        })

        mult = multiplier_for(kind)
        direction = 1 if side == "BUY" else -1       # BUY increases long / reduces short
        signed_qty = direction * qty_raw              # contracts or shares (signed)
        current_qty = float(pos["qty"])

        # --- Validations: no negative equities; no crossing zero on options or shares
        if kind == "SHARES" and (current_qty + signed_qty) < 0:
            ledger.append({**row_base, "cashDelta": 0.0, "balanceAfter": balances[acc],
                           "accepted": False, "error": "Equities cannot be negative (long-only)"})
            continue

        if current_qty != 0 and sign(current_qty) != sign(signed_qty):
            remaining = current_qty + signed_qty
            # If remaining != 0 and changed sign relative to current side → crossing
            if remaining != 0 and sign(remaining) != sign(current_qty):
                ledger.append({**row_base, "cashDelta": 0.0, "balanceAfter": balances[acc],
                               "accepted": False, "error": "Crossing zero not allowed"})
                continue

        # --- Cash effect (apply only if accepted)
        cash_delta = -(signed_qty * price * mult) - fees

        # --- Fee allocation (for avgPrice on opens/adds)
        units = abs(qty_raw) * mult                     # shares or contracts*100
        fee_per_unit = (fees / units) if units else 0.0
        entry_unit_cost = price + fee_per_unit          # used when adding/opening

        # --- Optional coverage hints on open/add (advisory only)
        # Set when we are increasing magnitude on the short side
        will_increase_magnitude = abs(current_qty + signed_qty) > abs(current_qty) and sign(current_qty or 0.0) == sign(signed_qty) or current_qty == 0
        if will_increase_magnitude:
            if kind == "CALL" and direction == -1:  # selling calls (short)
                covered = shares_qty(positions, acc, ticker) >= int(abs(current_qty + signed_qty) * 100)
                pos["coverageHint"] = "COVERED" if covered else "NAKED"
            if kind == "PUT" and direction == -1:   # selling puts (short)
                cash_needed = float(strike) * 100.0 * abs(current_qty + signed_qty)
                pos["coverageHint"] = "CASH_SECURED" if balances[acc] >= cash_needed else "NAKED"

        # --- Position update + Realized P&L on reductions
        # Case A: opening from flat
        if current_qty == 0:
            pos["qty"] = signed_qty
            pos["avgPrice"] = entry_unit_cost

        else:
            same_side = sign(current_qty) == sign(signed_qty)

            if same_side:
                new_qty = current_qty + signed_qty
                # If magnitude increases → ADD (recompute weighted avg with fee-inclusive unit cost)
                if abs(new_qty) > abs(current_qty):
                    base_units = abs(current_qty) * mult
                    add_units = abs(signed_qty) * mult
                    # Weighted average per unit (already fee-inclusive on the add)
                    pos["avgPrice"] = (base_units * pos["avgPrice"] + add_units * entry_unit_cost) / (base_units + add_units)
                    pos["qty"] = new_qty
                else:
                    # Same-side REDUCE (partial close)
                    closed_qty = abs(signed_qty)                   # in shares or contracts
                    open_avg = pos["avgPrice"]
                    if current_qty > 0:  # long side reducing
                        pnl = (price - open_avg) * closed_qty * mult - fees
                    else:                # short side covering partially
                        pnl = (open_avg - price) * closed_qty * mult - fees

                    realized.append({
                        "account_id": acc,
                        "timestamp": t.get("timestamp"),
                        "instrumentKey": key_str,
                        "instrument_kind": kind,
                        "ticker": ticker,
                        "closedQty": closed_qty,
                        "closePrice": price,
                        "openAvgPrice": open_avg,
                        "multiplier": mult,
                        "closeFees": fees,
                        "realizedPnL": pnl,
                        "coverageAtOpen": pos.get("coverageHint"),
                        "memo": memo
                    })
                    pos["qty"] = new_qty
                    if pos["qty"] == 0:
                        pos["avgPrice"] = 0.0

            else:
                # Opposite side → REDUCE toward zero (not crossing per validation)
                new_qty = current_qty + signed_qty
                closed_qty = abs(signed_qty)
                open_avg = pos["avgPrice"]
                if current_qty > 0:  # long closing with SELL
                    pnl = (price - open_avg) * closed_qty * mult - fees
                else:                # short covering with BUY
                    pnl = (open_avg - price) * closed_qty * mult - fees

                realized.append({
                    "account_id": acc,
                    "timestamp": t.get("timestamp"),
                    "instrumentKey": key_str,
                    "instrument_kind": kind,
                    "ticker": ticker,
                    "closedQty": closed_qty,
                    "closePrice": price,
                    "openAvgPrice": open_avg,
                    "multiplier": mult,
                    "closeFees": fees,
                    "realizedPnL": pnl,
                    "coverageAtOpen": pos.get("coverageHint"),
                    "memo": memo
                })
                pos["qty"] = new_qty
                if pos["qty"] == 0:
                    pos["avgPrice"] = 0.0

        # Persist position & cash; append ledger row
        positions[key] = pos
        balances[acc] += cash_delta
        ledger.append({**row_base, "cashDelta": cash_delta, "balanceAfter": balances[acc], "accepted": True})

    return {
        "positions": positions,   # map keyed by (account_id, instrumentKey)
        "balances": balances,     # map account_id -> cash balance
        "ledger": ledger,         # list of per-transaction ledger rows
        "realized": realized      # list of realized P&L events
    }
```

### Notes

* **Inputs**: pass your raw `transactions` rows (dicts) exactly as defined in your schema.
* **Sorting**: done by `(timestamp, id)` to ensure deterministic results for same-time fills.
* **No crossings**: attempts to cross through zero are rejected and show up in the ledger with `accepted=False` (and no balance/position change).
* **AvgPrice**: open-side fees are allocated into `avgPrice` when opening/adding; realized P\&L subtracts only **closing** fees.
* **Coverage**: `coverageHint` is optional and advisory; it’s (re)computed when opening/adding short calls/puts based on concurrent shares or cash.

If you want a tiny test snippet or a convenience wrapper to print a statement for one account, say the word and I’ll add it.

---

## 11) What gets tracked (explicit)

* **Open positions**: SHARES, CALL, PUT (optional `coverageHint`).
* **Closures**: every full/partial close emits a **RealizedEvent** dated at the **closing transaction**.
* **Running balances**: every transaction gets `cashDelta` and `balanceAfter` for its **account**.
* **Validation**: crossings and negative equities are rejected (ledger `accepted=false`, no effects).

---

If you want, I can package this into a tiny reference implementation (TypeScript) with 6–8 unit tests mirroring these rules.
