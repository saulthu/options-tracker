/**
 * Portfolio Calculator - Business Logic Module
 * 
 * Implements the trading ledger schema business rules:
 * - Single source of truth: Transaction table
 * - All positions, balances, and P&L derived in memory
 * - Multi-account support
 * - No crossings (shares can't go negative, options can't cross zero)
 * - Running balance per transaction
 * - Realized P&L events on partial/full closes
 */

export type InstrumentKind = 'CASH' | 'SHARES' | 'CALL' | 'PUT';
export type Side = 'BUY' | 'SELL';
export type CoverageHint = 'COVERED' | 'CASH_SECURED' | 'NAKED';

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  timestamp: string; // ISO8601 broker event time
  created_at: string;
  updated_at: string;
  instrument_kind: 'CASH' | 'SHARES' | 'CALL' | 'PUT';
  ticker_id?: string;
  expiry?: string; // YYYY-MM-DD
  strike?: number;
  side?: 'BUY' | 'SELL';
  qty: number;
  price?: number;
  fees: number;
  memo?: string;
}

export interface Position {
  accountId: string;
  instrumentKey: string;
  instrumentKind: InstrumentKind;
  ticker: string;
  qty: number; // SHARES ≥ 0; CALL/PUT may be >0 (long) or <0 (short)
  avgPrice: number; // weighted average ENTRY cost per unit (includes allocated open-side fees)
  expiry?: string;
  strike?: number;
  coverageHint?: CoverageHint;
}

export interface CashBalance {
  accountId: string;
  balance: number;
}

export interface LedgerRow {
  txnId: string;
  accountId: string;
  timestamp: string;
  instrumentKind: InstrumentKind;
  ticker?: string;
  expiry?: string;
  strike?: number;
  side?: Side;
  qty: number;
  price?: number;
  fees: number;
  memo?: string;
  cashDelta: number; // +/− cash effect of this txn
  balanceAfter: number; // account's running balance AFTER applying this txn
  accepted: boolean; // false if rejected by validation
  error?: string; // rejection reason
}

export interface RealizedEvent {
  accountId: string;
  timestamp: string;
  instrumentKey: string;
  instrumentKind: InstrumentKind;
  ticker: string;
  closedQty: number; // absolute units closed in this event
  closePrice: number; // per unit
  openAvgPrice: number; // per unit, BEFORE close
  multiplier: number; // 1 for SHARES, 100 for options
  closeFees: number; // fees charged on this closing txn
  realizedPnL: number; // (closePrice - openAvgPrice) * closedQty * multiplier - closeFees
  coverageAtOpen?: CoverageHint;
  memo?: string;
}

export interface PortfolioState {
  positions: Map<string, Position>; // key: `${accountId}|${instrumentKey}`
  balances: Map<string, number>; // key: accountId
  ledger: LedgerRow[];
  realized: RealizedEvent[];
}

// Helper functions
export function instrumentKey(
  kind: InstrumentKind, 
  ticker?: string, 
  expiry?: string, 
  strike?: number
): string {
  if (kind === 'CASH') return 'CASH';
  if (kind === 'SHARES') return ticker!;
  return `${ticker}|${expiry}|${strike}|${kind}`;
}

export function isOption(kind: InstrumentKind): boolean {
  return kind === 'CALL' || kind === 'PUT';
}

export function multiplierFor(kind: InstrumentKind): number {
  return isOption(kind) ? 100 : 1;
}

export function sign(x: number): number {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

export function getPositionKey(accountId: string, instrumentKey: string): string {
  return `${accountId}|${instrumentKey}`;
}

export function sharesQty(
  positions: Map<string, Position>, 
  accountId: string, 
  ticker: string
): number {
  const key = getPositionKey(accountId, instrumentKey('SHARES', ticker));
  const pos = positions.get(key);
  return pos ? pos.qty : 0;
}

/**
 * Main portfolio calculation function
 * Processes transactions and derives all positions, balances, and P&L
 */
export function buildPortfolio(
  transactions: Transaction[],
  openingBalances: Record<string, number> = {}
): PortfolioState {
  // Sort deterministically by (timestamp ASC, id ASC)
  const sortedTxns = [...transactions].sort((a, b) => {
    const timeCompare = a.timestamp.localeCompare(b.timestamp);
    if (timeCompare !== 0) return timeCompare;
    return a.id.localeCompare(b.id);
  });

  const balances = new Map<string, number>();
  const positions = new Map<string, Position>();
  const ledger: LedgerRow[] = [];
  const realized: RealizedEvent[] = [];

  for (const t of sortedTxns) {
    const acc = t.account_id;
    balances.set(acc, balances.get(acc) ?? openingBalances[acc] ?? 0);

    const kind = t.instrument_kind;
    const fees = t.fees || 0;
    const memo = t.memo || '';

    const rowBase: Omit<LedgerRow, 'cashDelta' | 'balanceAfter' | 'accepted' | 'error'> = {
      txnId: t.id,
      accountId: acc,
      timestamp: t.timestamp,
      instrumentKind: kind,
      ticker: t.ticker_id,
      expiry: t.expiry,
      strike: t.strike,
      side: t.side,
      qty: t.qty,
      price: t.price,
      fees,
      memo,
    };

    // Handle CASH transactions
    if (kind === 'CASH') {
      const cashDelta = t.qty;
      const newBalance = (balances.get(acc) || 0) + cashDelta;
      balances.set(acc, newBalance);
      
      ledger.push({
        ...rowBase,
        cashDelta,
        balanceAfter: newBalance,
        accepted: true,
      });
      continue;
    }

    // Handle SHARES/CALL/PUT transactions
    const ticker = t.ticker_id!;
    const expiry = t.expiry;
    const strike = t.strike;
    const price = t.price!;
    const side = t.side!;
    const qtyRaw = t.qty;

    const keyStr = instrumentKey(kind, ticker, expiry, strike);
    const key = getPositionKey(acc, keyStr);

    let pos = positions.get(key);
    if (!pos) {
      pos = {
        accountId: acc,
        instrumentKey: keyStr,
        instrumentKind: kind,
        ticker,
        qty: 0,
        avgPrice: 0,
        expiry,
        strike,
      };
    }

    const mult = multiplierFor(kind);
    const direction = side === 'BUY' ? 1 : -1; // BUY increases long / reduces short
    const signedQty = direction * qtyRaw; // contracts or shares (signed)
    const currentQty = pos.qty;

    // Validations: no negative equities; no crossing zero
    if (kind === 'SHARES' && (currentQty + signedQty) < 0) {
      ledger.push({
        ...rowBase,
        cashDelta: 0,
        balanceAfter: balances.get(acc) || 0,
        accepted: false,
        error: 'Equities cannot be negative (long-only)',
      });
      continue;
    }

    if (currentQty !== 0 && sign(currentQty) !== sign(signedQty)) {
      const remaining = currentQty + signedQty;
      // If remaining != 0 and changed sign relative to current side → crossing
      if (remaining !== 0 && sign(remaining) !== sign(currentQty)) {
        ledger.push({
          ...rowBase,
          cashDelta: 0,
          balanceAfter: balances.get(acc) || 0,
          accepted: false,
          error: 'Crossing zero not allowed',
        });
        continue;
      }
    }

    // Cash effect (apply only if accepted)
    const cashDelta = -(signedQty * price * mult) - fees;

    // Fee allocation (for avgPrice on opens/adds)
    const units = Math.abs(qtyRaw) * mult; // shares or contracts*100
    const feePerUnit = units > 0 ? fees / units : 0;
    const entryUnitCost = price + feePerUnit; // used when adding/opening

    // Optional coverage hints on open/add (advisory only)
    const willIncreaseMagnitude = 
      Math.abs(currentQty + signedQty) > Math.abs(currentQty) && 
      (sign(currentQty || 0) === sign(signedQty) || currentQty === 0);

    if (willIncreaseMagnitude) {
      if (kind === 'CALL' && direction === -1) { // selling calls (short)
        const covered = sharesQty(positions, acc, ticker) >= Math.abs(currentQty + signedQty) * 100;
        pos.coverageHint = covered ? 'COVERED' : 'NAKED';
      }
      if (kind === 'PUT' && direction === -1) { // selling puts (short)
        const cashNeeded = strike! * 100 * Math.abs(currentQty + signedQty);
        pos.coverageHint = (balances.get(acc) || 0) >= cashNeeded ? 'CASH_SECURED' : 'NAKED';
      }
    }

    // Position update + Realized P&L on reductions
    if (currentQty === 0) {
      // Opening from flat
      pos.qty = signedQty;
      pos.avgPrice = entryUnitCost;
    } else {
      const sameSide = sign(currentQty) === sign(signedQty);

      if (sameSide) {
        const newQty = currentQty + signedQty;
        // If magnitude increases → ADD (recompute weighted avg)
        if (Math.abs(newQty) > Math.abs(currentQty)) {
          const baseUnits = Math.abs(currentQty) * mult;
          const addUnits = Math.abs(signedQty) * mult;
          // Weighted average per unit (already fee-inclusive on the add)
          pos.avgPrice = (baseUnits * pos.avgPrice + addUnits * entryUnitCost) / (baseUnits + addUnits);
          pos.qty = newQty;
        } else {
          // Same-side REDUCE (partial close)
          const closedQty = Math.abs(signedQty);
          const openAvg = pos.avgPrice;
          let pnl: number;
          
          if (currentQty > 0) { // long side reducing
            pnl = (price - openAvg) * closedQty * mult - fees;
          } else { // short side covering partially
            pnl = (openAvg - price) * closedQty * mult - fees;
          }

          realized.push({
            accountId: acc,
            timestamp: t.timestamp,
            instrumentKey: keyStr,
            instrumentKind: kind,
            ticker,
            closedQty,
            closePrice: price,
            openAvgPrice: openAvg,
            multiplier: mult,
            closeFees: fees,
            realizedPnL: pnl,
            coverageAtOpen: pos.coverageHint,
            memo,
          });
          
          pos.qty = newQty;
          if (pos.qty === 0) {
            pos.avgPrice = 0;
          }
        }
      } else {
        // Opposite side → REDUCE toward zero (not crossing per validation)
        const newQty = currentQty + signedQty;
        const closedQty = Math.abs(signedQty);
        const openAvg = pos.avgPrice;
        let pnl: number;
        
        if (currentQty > 0) { // long closing with SELL
          pnl = (price - openAvg) * closedQty * mult - fees;
        } else { // short covering with BUY
          pnl = (openAvg - price) * closedQty * mult - fees;
        }

        realized.push({
          accountId: acc,
          timestamp: t.timestamp,
          instrumentKey: keyStr,
          instrumentKind: kind,
          ticker,
          closedQty,
          closePrice: price,
          openAvgPrice: openAvg,
          multiplier: mult,
          closeFees: fees,
          realizedPnL: pnl,
          coverageAtOpen: pos.coverageHint,
          memo,
        });
        
        pos.qty = newQty;
        if (pos.qty === 0) {
          pos.avgPrice = 0;
        }
      }
    }

    // Persist position & cash; append ledger row
    positions.set(key, pos);
    const newBalance = (balances.get(acc) || 0) + cashDelta;
    balances.set(acc, newBalance);
    
    ledger.push({
      ...rowBase,
      cashDelta,
      balanceAfter: newBalance,
      accepted: true,
    });
  }

  return {
    positions,
    balances,
    ledger,
    realized,
  };
}

/**
 * Get positions for a specific account
 */
export function getAccountPositions(
  portfolio: PortfolioState, 
  accountId: string
): Position[] {
  const accountPositions: Position[] = [];
  
  for (const [, position] of portfolio.positions) {
    if (position.accountId === accountId) {
      accountPositions.push(position);
    }
  }
  
  return accountPositions;
}

/**
 * Get realized P&L for a specific account
 */
export function getAccountRealizedPnL(
  portfolio: PortfolioState, 
  accountId: string
): RealizedEvent[] {
  return portfolio.realized.filter(event => event.accountId === accountId);
}

/**
 * Get cash balance for a specific account
 */
export function getAccountBalance(
  portfolio: PortfolioState, 
  accountId: string
): number {
  return portfolio.balances.get(accountId) || 0;
}

/**
 * Get total realized P&L for an account
 */
export function getTotalRealizedPnL(
  portfolio: PortfolioState, 
  accountId: string
): number {
  return getAccountRealizedPnL(portfolio, accountId)
    .reduce((sum, event) => sum + event.realizedPnL, 0);
}

/**
 * Get unrealized P&L for a position (requires current market price)
 */
export function getUnrealizedPnL(
  position: Position, 
  currentPrice: number
): number {
  if (position.qty === 0) return 0;
  
  const mult = multiplierFor(position.instrumentKind);
  const priceDiff = currentPrice - position.avgPrice;
  return priceDiff * position.qty * mult;
}
