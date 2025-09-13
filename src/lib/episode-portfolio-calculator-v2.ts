// Episode-based Portfolio Calculator V2
// Designed from the ground up to work with CurrencyAmount throughout
// Based on updated_portfolio_calc.md specification

import {
  RawTransaction,
  LedgerRow,
  PositionEpisode,
  PortfolioResult,
  TickerLookup,
  OpeningBalances,
  InstrumentKind,
  KindGroup
} from '../types/episodes';
import { CurrencyAmount, CurrencyCode } from './currency-amount';

// -----------------------------
// Helper Functions
// -----------------------------

/**
 * Parse ISO timestamp string to Date object
 */
function parseIso(ts: string): Date {
  return new Date(ts.replace('Z', '+00:00'));
}

/**
 * Create instrument key for a transaction
 */
function instrumentKey(kind: InstrumentKind, ticker?: string, expiry?: string, strike?: CurrencyAmount): string {
  if (kind === 'CASH') return 'CASH';
  if (kind === 'SHARES') return ticker || '';
  return `${ticker}|${expiry}|${strike?.amount || ''}|${kind}`;
}

/**
 * Create episode key for grouping transactions
 */
function episodeKey(kind: InstrumentKind, ticker?: string, strike?: CurrencyAmount, expiry?: string): string {
  if (kind === 'CASH') return 'CASH';
  if (kind === 'SHARES') return ticker || '';
  // Options: group by ticker + right + strike + expiry (each unique contract is separate)
  return `${ticker}|${kind}|${strike?.amount || ''}|${expiry}`;
}

/**
 * Check if instrument is an option
 */
function isOption(kind: InstrumentKind): boolean {
  return kind === 'CALL' || kind === 'PUT';
}

/**
 * Determine option directionality based on opening transaction
 */
function getOptionDirection(side: 'BUY' | 'SELL', right: 'CALL' | 'PUT'): 'CSP' | 'CC' | 'CALL' | 'PUT' {
  if (side === 'SELL' && right === 'PUT') {
    return 'CSP'; // Cash Secured Put
  } else if (side === 'SELL' && right === 'CALL') {
    return 'CC'; // Covered Call
  } else if (side === 'BUY' && right === 'CALL') {
    return 'CALL';
  } else if (side === 'BUY' && right === 'PUT') {
    return 'PUT';
  }
  // Fallback
  return right;
}

/**
 * Determine action term for a transaction based on position opening
 */
function getActionTerm(
  side: 'BUY' | 'SELL', 
  instrumentKind: InstrumentKind, 
  openingSide?: 'BUY' | 'SELL'
): 'BTO' | 'STO' | 'BTC' | 'STC' | 'BUY' | 'SELL' {
  if (instrumentKind === 'CASH' || instrumentKind === 'SHARES') {
    return side; // Keep BUY/SELL for cash and shares
  }
  
  if (instrumentKind === 'CALL' || instrumentKind === 'PUT') {
    if (!openingSide) {
      // If we don't know the opening side, assume it's opening
      return side === 'BUY' ? 'BTO' : 'STO';
    }
    
    const wasOpenedWithSell = openingSide === 'SELL';
    
    if (side === 'BUY') {
      return wasOpenedWithSell ? 'BTC' : 'BTO'; // Buy To Close if opened with sell, Buy To Open otherwise
    } else if (side === 'SELL') {
      return wasOpenedWithSell ? 'STO' : 'STC'; // Sell To Open if opened with sell, Sell To Close otherwise
    }
  }
  
  return side; // Fallback
}

/**
 * Get multiplier for instrument (100 for options, 1 for shares)
 */
function multiplierFor(kind: InstrumentKind): number {
  return isOption(kind) ? 100 : 1;
}

/**
 * Get sign of a number
 */
function sign(x: number): number {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

// -----------------------------
// Pass 1: Build Ledger
// -----------------------------

/**
 * Build ledger rows from raw transactions
 * Enforces validation rules and calculates running balances
 */
function buildLedger(
  transactions: RawTransaction[],
  tickerLookup: TickerLookup,
  openingBalances: OpeningBalances = new Map()
): { ledger: LedgerRow[]; balances: Map<string, Map<CurrencyCode, CurrencyAmount>> } {
  // Sort transactions deterministically by (timestamp ASC, id ASC)
  const sortedTxns = [...transactions].sort((a, b) => {
    const timeCompare = a.timestamp.localeCompare(b.timestamp);
    return timeCompare !== 0 ? timeCompare : a.id.localeCompare(b.id);
  });

  const balances = new Map<string, Map<CurrencyCode, CurrencyAmount>>();
  const positions = new Map<string, number>(); // (userId, accountId, instrumentKey) -> qty
  const ledger: LedgerRow[] = [];

  for (const t of sortedTxns) {
    const userId = t.user_id;
    const accountId = t.account_id;
    const kind = t.instrument_kind;
    const fees = t.fees;

    // Initialize account balance for this currency
    if (!balances.has(accountId)) {
      balances.set(accountId, new Map<CurrencyCode, CurrencyAmount>());
    }
    
    const accountBalances = balances.get(accountId)!;
    const currency = fees.currency;
    
    if (!accountBalances.has(currency)) {
      const openingBalance = openingBalances.get(accountId) || CurrencyAmount.zero(currency);
      accountBalances.set(currency, openingBalance);
    }

    // Resolve ticker name
    const ticker = t.ticker_id ? tickerLookup.get(t.ticker_id) : undefined;
    const expiry = t.expiry;
    const strike = t.strike;
    const side = t.side;
    const qty = t.qty;
    const price = t.price;

    // Handle CASH transactions
    if (kind === 'CASH') {
      // For cash transactions: qty * price (where price = 1.0 with correct currency)
      if (!price) {
        throw new Error('Price should be set to 1.0 for cash transactions');
      }
      const cashDelta = price.multiply(qty);
      const currentBalance = accountBalances.get(currency)!;
      const newBalance = currentBalance.add(cashDelta);
      accountBalances.set(currency, newBalance);

      ledger.push({
        txnId: t.id,
        userId,
        accountId,
        timestamp: t.timestamp,
        instrumentKind: kind,
        ticker: undefined,
        expiry: undefined,
        strike: undefined,
        side: undefined,
        qty,
        price: price, // This will be CurrencyAmount(1.0, currency) for cash
        fees,
        memo: t.memo,
        cashDelta,
        balanceAfter: newBalance,
        accepted: true
      });
      continue;
    }

    // Handle trading transactions (SHARES, CALL, PUT)
    if (!side || !ticker) {
      // Invalid transaction - missing required fields
      const currentBalance = accountBalances.get(currency)!;
      ledger.push({
        txnId: t.id,
        userId,
        accountId,
        timestamp: t.timestamp,
        instrumentKind: kind,
        ticker,
        expiry,
        strike,
        side,
        qty,
        price,
        fees,
        memo: t.memo,
        cashDelta: CurrencyAmount.zero(fees.currency),
        balanceAfter: currentBalance,
        accepted: false,
        error: 'Missing required fields (side or ticker)'
      });
      continue;
    }

    const instrumentKeyStr = instrumentKey(kind, ticker, expiry, strike);
    const positionKey = `${userId}|${accountId}|${instrumentKeyStr}`;
    const currentQty = positions.get(positionKey) || 0;

    const direction = side === 'BUY' ? 1 : -1;
    const signedQty = direction * qty;

    // Validation rules
    if (kind === 'SHARES' && currentQty + signedQty < 0) {
      // SHARES cannot go negative (long-only)
      const currentBalance = accountBalances.get(currency)!;
      ledger.push({
        txnId: t.id,
        userId,
        accountId,
        timestamp: t.timestamp,
        instrumentKind: kind,
        ticker,
        expiry,
        strike,
        side,
        qty,
        price,
        fees,
        memo: t.memo,
        cashDelta: CurrencyAmount.zero(fees.currency),
        balanceAfter: currentBalance,
        accepted: false,
        error: 'Equities cannot be negative (long-only)'
      });
      continue;
    }

    if (currentQty !== 0 && sign(currentQty) !== sign(signedQty)) {
      const remaining = currentQty + signedQty;
      // Check for crossing zero
      if (remaining !== 0 && sign(remaining) !== sign(currentQty)) {
        const currentBalance = accountBalances.get(currency)!;
        ledger.push({
          txnId: t.id,
          userId,
          accountId,
          timestamp: t.timestamp,
          instrumentKind: kind,
          ticker,
          expiry,
          strike,
          side,
          qty,
          price,
          fees,
          memo: t.memo,
          cashDelta: CurrencyAmount.zero(fees.currency),
          balanceAfter: currentBalance,
          accepted: false,
          error: 'Crossing zero not allowed'
        });
        continue;
      }
    }

    // Transaction accepted - calculate cash effect and update positions
    const mult = multiplierFor(kind);
    const effectivePrice = price || CurrencyAmount.zero(currency);
    const effectiveFees = fees || CurrencyAmount.zero(currency);
    
    // Calculate cash delta: -(signedQty * price * mult) - fees
    const grossValue = effectivePrice.multiply(signedQty * mult);
    const cashDelta = grossValue.multiply(-1).subtract(effectiveFees);
    
    const currentBalance = accountBalances.get(currency)!;
    const newBalance = currentBalance.add(cashDelta);
    accountBalances.set(currency, newBalance);
    positions.set(positionKey, currentQty + signedQty);

    ledger.push({
      txnId: t.id,
      userId,
      accountId,
      timestamp: t.timestamp,
      instrumentKind: kind,
      ticker,
      expiry,
      strike,
      side,
      qty,
      price,
      fees,
      memo: t.memo,
      cashDelta,
      balanceAfter: newBalance,
      accepted: true
    });
  }

  return { ledger, balances };
}

// -----------------------------
// Pass 2: Build Episodes
// -----------------------------

/**
 * Build position episodes from ledger rows
 * Groups related transactions into logical episodes with option roll detection
 */
function buildEpisodes(ledger: LedgerRow[]): PositionEpisode[] {
  // Filter to only accepted transactions and sort by timestamp
  const accepted = ledger.filter(lr => lr.accepted).sort((a, b) => {
    const timeCompare = a.timestamp.localeCompare(b.timestamp);
    return timeCompare !== 0 ? timeCompare : a.txnId.localeCompare(b.txnId);
  });

  const episodes: PositionEpisode[] = [];
  const activeEpisodes = new Map<string, PositionEpisode>(); // (userId, accountId, episodeKey) -> episode
  const closedOptionEpisodes = new Map<string, PositionEpisode>(); // (userId, accountId, ticker, right) -> episode

  /**
   * Create a cash episode (single transaction)
   */
  function createCashEpisode(lr: LedgerRow): PositionEpisode {
    const episode: PositionEpisode = {
      episodeId: `${lr.userId}|${lr.accountId}|CASH|${lr.txnId}`,
      userId: lr.userId,
      accountId: lr.accountId,
      episodeKey: 'CASH',
      kindGroup: 'CASH',
      openTimestamp: lr.timestamp,
      closeTimestamp: lr.timestamp, // Cash episodes close immediately
      rolled: false,
      qty: lr.qty,
      avgPrice: CurrencyAmount.zero(lr.cashDelta.currency),
      totalFees: CurrencyAmount.zero(lr.cashDelta.currency),
      cashTotal: lr.cashDelta,
      realizedPnLTotal: CurrencyAmount.zero(lr.cashDelta.currency),
      txns: [{
        txnId: lr.txnId,
        timestamp: lr.timestamp,
        instrumentKind: 'CASH',
        ticker: undefined,
        expiry: undefined,
        strike: undefined,
        side: undefined,
        qty: lr.qty,
        price: lr.price,
        fees: lr.fees,
        cashDelta: lr.cashDelta,
        realizedPnLDelta: CurrencyAmount.zero(lr.cashDelta.currency),
        note: lr.memo
      }]
    };
    episodes.push(episode);
    return episode;
  }

  /**
   * Apply a trade to an existing episode
   */
  function applyTradeToEpisode(episode: PositionEpisode, lr: LedgerRow, note?: string): void {
    const mult = multiplierFor(lr.instrumentKind);
    const direction = lr.side === 'BUY' ? 1 : -1;
    const signedQty = direction * lr.qty;
    const price = lr.price || CurrencyAmount.zero(lr.fees.currency);
    const fees = lr.fees;

    const units = Math.abs(lr.qty) * mult;
    const feePerUnit = units > 0 ? fees.divide(units) : CurrencyAmount.zero(fees.currency);
    const entryUnitCost = price.add(feePerUnit);

    // Update current leg snapshot for options
    if (isOption(lr.instrumentKind)) {
      episode.currentInstrumentKey = instrumentKey(lr.instrumentKind, lr.ticker, lr.expiry, lr.strike);
      episode.currentRight = lr.instrumentKind as 'CALL' | 'PUT';
      episode.currentExpiry = lr.expiry;
      episode.currentStrike = lr.strike;
    }

    let realizedPnL = CurrencyAmount.zero(fees.currency);

    if (episode.qty === 0 || (sign(episode.qty) === sign(signedQty) && Math.abs(episode.qty + signedQty) > Math.abs(episode.qty))) {
      // Opening or adding to position
      if (episode.qty === 0) {
        // Opening from flat
        episode.avgPrice = entryUnitCost;
      } else {
        // Adding to existing position - weighted average
        const baseUnits = Math.abs(episode.qty) * mult;
        const addUnits = Math.abs(signedQty) * mult;
        const totalUnits = baseUnits + addUnits;
        
        if (totalUnits > 0) {
          const baseValue = episode.avgPrice.multiply(baseUnits);
          const addValue = entryUnitCost.multiply(addUnits);
          episode.avgPrice = baseValue.add(addValue).divide(totalUnits);
        }
      }
    } else {
      // Reducing position - calculate realized P&L
      const closedQty = Math.abs(signedQty);
      if (episode.qty > 0) {
        // Long position being reduced
        const priceDiff = price.subtract(episode.avgPrice);
        realizedPnL = priceDiff.multiply(closedQty * mult).subtract(fees);
      } else {
        // Short position being covered
        const priceDiff = episode.avgPrice.subtract(price);
        realizedPnL = priceDiff.multiply(closedQty * mult).subtract(fees);
      }
      episode.realizedPnLTotal = episode.realizedPnLTotal.add(realizedPnL);
    }

    // Update episode quantities and totals
    episode.qty += signedQty;
    episode.totalFees = episode.totalFees.add(fees);
    episode.cashTotal = episode.cashTotal.add(lr.cashDelta);

    // Determine action term based on opening transaction
    const openingSide = episode.txns.length === 0 ? lr.side : episode.txns[0].side;
    const actionTerm = lr.side ? getActionTerm(lr.side, lr.instrumentKind, openingSide) : undefined;

    // Add transaction to episode
    episode.txns.push({
      txnId: lr.txnId,
      timestamp: lr.timestamp,
      instrumentKind: lr.instrumentKind,
      ticker: lr.ticker,
      expiry: lr.expiry,
      strike: lr.strike,
      side: lr.side,
      qty: lr.qty,
      price: lr.price,
      fees: lr.fees,
      cashDelta: lr.cashDelta,
      realizedPnLDelta: realizedPnL,
      note: note || lr.memo,
      actionTerm
    });

    // Check if position is closed
    if (episode.qty === 0) {
      // Don't reset avgPrice to 0 - preserve historical context
      // The avgPrice represents the average entry price for the position
      episode.closeTimestamp = lr.timestamp;
    }
  }

  /**
   * Start a new episode
   */
  function startNewEpisode(lr: LedgerRow, note?: string): PositionEpisode {
    const episodeKeyStr = episodeKey(lr.instrumentKind, lr.ticker, lr.strike, lr.expiry);
    const kindGroup: KindGroup = isOption(lr.instrumentKind) ? 'OPTION' : lr.instrumentKind as KindGroup;
    
    // Determine option directionality for options
    const optionDirection = isOption(lr.instrumentKind) && lr.side && lr.instrumentKind !== 'CASH' && lr.instrumentKind !== 'SHARES'
      ? getOptionDirection(lr.side, lr.instrumentKind as 'CALL' | 'PUT')
      : undefined;
    
    const episode: PositionEpisode = {
      episodeId: `${lr.userId}|${lr.accountId}|${episodeKeyStr}|${lr.txnId}`,
      userId: lr.userId,
      accountId: lr.accountId,
      episodeKey: episodeKeyStr,
      kindGroup,
      openTimestamp: lr.timestamp,
      closeTimestamp: undefined,
      rolled: false,
      qty: 0,
      avgPrice: CurrencyAmount.zero(lr.fees.currency),
      totalFees: CurrencyAmount.zero(lr.fees.currency),
      cashTotal: CurrencyAmount.zero(lr.fees.currency),
      realizedPnLTotal: CurrencyAmount.zero(lr.fees.currency),
      optionDirection,
      txns: []
    };

    applyTradeToEpisode(episode, lr, note || lr.memo);
    activeEpisodes.set(`${lr.userId}|${lr.accountId}|${episodeKeyStr}`, episode);
    episodes.push(episode);
    return episode;
  }

  /**
   * Check if this transaction can roll into a closed option episode
   */
  function tryOptionRoll(lr: LedgerRow): PositionEpisode | null {
    if (!isOption(lr.instrumentKind) || !lr.ticker) return null;

    const userId = lr.userId;
    const accountId = lr.accountId;
    const ticker = lr.ticker;
    const right = lr.instrumentKind;
    const strike = lr.strike;
    const expiry = lr.expiry;
    const rollKey = `${userId}|${accountId}|${ticker}|${right}|${strike?.amount || ''}|${expiry}`;
    
    const closedEpisode = closedOptionEpisodes.get(rollKey);
    if (!closedEpisode || !closedEpisode.closeTimestamp) return null;

    // Check if within 10 hours
    const lastCloseTime = parseIso(closedEpisode.closeTimestamp);
    const currentTime = parseIso(lr.timestamp);
    const hoursDiff = (currentTime.getTime() - lastCloseTime.getTime()) / (1000 * 60 * 60);
    if (hoursDiff > 10) return null;

    // Check if opposite side and equal quantity
    const lastTxn = closedEpisode.txns[closedEpisode.txns.length - 1];
    if (!lastTxn || !lastTxn.side) return null;
    
    const isOppositeSide = (lastTxn.side === 'BUY' && lr.side === 'SELL') || 
                          (lastTxn.side === 'SELL' && lr.side === 'BUY');
    const isEqualQuantity = Math.abs(lastTxn.qty) === Math.abs(lr.qty);
    
    // For a roll, strike or expiry must be different (indicating a new contract)
    const isDifferentStrike = lastTxn.strike && lr.strike ? !lastTxn.strike.equals(lr.strike) : lastTxn.strike !== lr.strike;
    const isDifferentExpiry = lastTxn.expiry !== lr.expiry;
    const isDifferentContract = isDifferentStrike || isDifferentExpiry;
    
    if (!isOppositeSide || !isEqualQuantity || !isDifferentContract) return null;

    // Roll the episode - reset for new position
    closedEpisode.rolled = true;
    closedEpisode.txns[closedEpisode.txns.length - 1].note = 'ROLL-CLOSE';
    closedEpisode.closeTimestamp = undefined;
    closedEpisode.qty = 0;
    closedEpisode.avgPrice = CurrencyAmount.zero(lr.fees.currency); // Reset for new position in roll
    
    applyTradeToEpisode(closedEpisode, lr, 'ROLL-OPEN');
    activeEpisodes.set(`${userId}|${accountId}|${episodeKey(right, ticker, lr.strike, lr.expiry)}`, closedEpisode);
    closedOptionEpisodes.delete(rollKey);
    
    return closedEpisode;
  }

  // Process all ledger rows
  for (const lr of accepted) {
    if (lr.instrumentKind === 'CASH') {
      createCashEpisode(lr);
      continue;
    }

    const episodeKeyStr = episodeKey(lr.instrumentKind, lr.ticker, lr.strike, lr.expiry);
    const activeKey = `${lr.userId}|${lr.accountId}|${episodeKeyStr}`;
    let episode = activeEpisodes.get(activeKey);

    if (!episode) {
      // Try option roll first
      const rolledEpisode = tryOptionRoll(lr);
      if (rolledEpisode) {
        continue; // Already processed in roll
      }
      
      // Start new episode
      episode = startNewEpisode(lr, lr.memo);
    } else {
      // Apply trade to existing episode
      applyTradeToEpisode(episode, lr, lr.memo);
      
      // Check if episode is now closed
      if (episode.qty === 0) {
        if (isOption(lr.instrumentKind) && lr.ticker) {
          // Store closed option episode for potential roll
          const rollKey = `${lr.userId}|${lr.accountId}|${lr.ticker}|${lr.instrumentKind}|${lr.strike?.amount || ''}|${lr.expiry}`;
          closedOptionEpisodes.set(rollKey, episode);
        }
        activeEpisodes.delete(activeKey);
      }
    }
  }

  // Sort episodes by user, account, episode key, and open timestamp
  episodes.sort((a, b) => {
    const userCompare = a.userId.localeCompare(b.userId);
    if (userCompare !== 0) return userCompare;
    
    const accountCompare = a.accountId.localeCompare(b.accountId);
    if (accountCompare !== 0) return accountCompare;
    
    const keyCompare = a.episodeKey.localeCompare(b.episodeKey);
    if (keyCompare !== 0) return keyCompare;
    
    return a.openTimestamp.localeCompare(b.openTimestamp);
  });

  return episodes;
}

// -----------------------------
// Main Export Function
// -----------------------------

/**
 * Build complete portfolio view from raw transactions
 * Returns ledger rows, balances, and position episodes
 */
export function buildPortfolioView(
  transactions: RawTransaction[],
  tickerLookup: TickerLookup,
  openingBalances: OpeningBalances = new Map()
): PortfolioResult {
  // Group by currency for separate processing
  const currencyGroups = new Map<CurrencyCode, RawTransaction[]>();
  for (const txn of transactions) {
    const currency = txn.fees.currency;
    if (!currencyGroups.has(currency)) {
      currencyGroups.set(currency, []);
    }
    currencyGroups.get(currency)!.push(txn);
  }
  
  // Process each currency group separately
  const allLedger: LedgerRow[] = [];
  const allBalances = new Map<string, Map<CurrencyCode, CurrencyAmount>>();
  const allEpisodes: PositionEpisode[] = [];
  
  for (const [, txns] of currencyGroups) {
    const { ledger, balances } = buildLedger(txns, tickerLookup, openingBalances);
    const episodes = buildEpisodes(ledger);
    
    allLedger.push(...ledger);
    for (const [accountId, accountBalances] of balances) {
      if (!allBalances.has(accountId)) {
        allBalances.set(accountId, new Map<CurrencyCode, CurrencyAmount>());
      }
      const existingBalances = allBalances.get(accountId)!;
      for (const [currency, balance] of accountBalances) {
        existingBalances.set(currency, balance);
      }
    }
    allEpisodes.push(...episodes);
  }
  
  return {
    ledger: allLedger,
    balances: allBalances,
    episodes: allEpisodes
  };
}

// -----------------------------
// Utility Functions
// -----------------------------

/**
 * Filter episodes by date range with different filtering modes
 */
export function filterEpisodesByDateRange(
  episodes: PositionEpisode[],
  startDate: string,
  endDate: string,
  filterType: 'overlap' | 'openedDuring' | 'closedDuring' = 'overlap'
): PositionEpisode[] {
  return episodes.filter(episode => {
    switch (filterType) {
      case 'overlap':
        // Position overlaps with date range if:
        // - It was opened before or during the range AND
        // - It was not closed OR was closed after the range started
        const openedBeforeOrDuring = episode.openTimestamp <= endDate;
        const notClosedOrClosedAfter = !episode.closeTimestamp || episode.closeTimestamp >= startDate;
        return openedBeforeOrDuring && notClosedOrClosedAfter;
        
      case 'openedDuring':
        // Only include positions opened within the date range
        return episode.openTimestamp >= startDate && episode.openTimestamp <= endDate;
        
      case 'closedDuring':
        // Only include positions closed within the date range
        return episode.closeTimestamp && 
               episode.closeTimestamp >= startDate && 
               episode.closeTimestamp <= endDate;
        
      default:
        return false;
    }
  });
}

/**
 * Get episodes for a specific account
 */
export function getAccountEpisodes(episodes: PositionEpisode[], accountId: string): PositionEpisode[] {
  return episodes.filter(episode => episode.accountId === accountId);
}

/**
 * Get open episodes (qty !== 0)
 */
export function getOpenEpisodes(episodes: PositionEpisode[]): PositionEpisode[] {
  return episodes.filter(episode => episode.qty !== 0);
}

/**
 * Get closed episodes (qty === 0)
 */
export function getClosedEpisodes(episodes: PositionEpisode[]): PositionEpisode[] {
  return episodes.filter(episode => episode.qty === 0);
}

/**
 * Get episodes by kind group
 */
export function getEpisodesByKind(episodes: PositionEpisode[], kindGroup: KindGroup): PositionEpisode[] {
  return episodes.filter(episode => episode.kindGroup === kindGroup);
}

/**
 * Get episodes by ticker
 */
export function getEpisodesByTicker(episodes: PositionEpisode[], ticker: string): PositionEpisode[] {
  return episodes.filter(episode => 
    episode.episodeKey === ticker || 
    episode.episodeKey.startsWith(`${ticker}|`)
  );
}

/**
 * Calculate total realized P&L across all episodes
 * Returns a map of currency to total P&L
 */
export function getTotalRealizedPnL(episodes: PositionEpisode[]): Map<CurrencyCode, CurrencyAmount> {
  const totals = new Map<CurrencyCode, CurrencyAmount>();
  
  for (const episode of episodes) {
    const currency = episode.realizedPnLTotal.currency;
    const currentTotal = totals.get(currency) || CurrencyAmount.zero(currency);
    totals.set(currency, currentTotal.add(episode.realizedPnLTotal));
  }
  
  return totals;
}

/**
 * Calculate total realized P&L for an account
 * Returns a map of currency to total P&L
 */
export function getAccountRealizedPnL(episodes: PositionEpisode[], accountId: string): Map<CurrencyCode, CurrencyAmount> {
  const accountEpisodes = getAccountEpisodes(episodes, accountId);
  const totals = new Map<CurrencyCode, CurrencyAmount>();
  
  for (const episode of accountEpisodes) {
    const currency = episode.realizedPnLTotal.currency;
    const currentTotal = totals.get(currency) || CurrencyAmount.zero(currency);
    totals.set(currency, currentTotal.add(episode.realizedPnLTotal));
  }
  
  return totals;
}

/**
 * Get account balance from balances map
 */
export function getAccountBalance(balances: Map<string, Map<CurrencyCode, CurrencyAmount>>, accountId: string): Map<CurrencyCode, CurrencyAmount> {
  return balances.get(accountId) || new Map<CurrencyCode, CurrencyAmount>();
}

/**
 * Create ticker lookup map from transactions
 */
export function createTickerLookup(transactions: RawTransaction[]): TickerLookup {
  const lookup = new Map<string, string>();
  
  for (const txn of transactions) {
    if (txn.ticker_id && txn.tickers?.name) {
      lookup.set(txn.ticker_id, txn.tickers.name);
    }
  }
  
  return lookup;
}

/**
 * Format episode for display
 */
export function formatEpisodeForDisplay(episode: PositionEpisode): string {
  const status = episode.qty === 0 ? 'CLOSED' : 'OPEN';
  const qty = episode.qty;
  const avgPrice = episode.avgPrice.format();
  const realizedPnL = episode.realizedPnLTotal.format();
  
  if (episode.kindGroup === 'CASH') {
    return `CASH ${status}: ${episode.cashTotal.format()}`;
  }
  
  if (episode.kindGroup === 'SHARES') {
    return `${episode.episodeKey} ${status}: ${qty} shares @ ${avgPrice} (P&L: ${realizedPnL})`;
  }
  
  if (episode.kindGroup === 'OPTION') {
    const right = episode.currentRight || 'UNKNOWN';
    const expiry = episode.currentExpiry || 'UNKNOWN';
    const strike = episode.currentStrike?.amount.toFixed(2) || 'UNKNOWN';
    return `${episode.episodeKey} ${status}: ${qty} contracts ${right} $${strike} ${expiry} (P&L: ${realizedPnL})`;
  }
  
  return `${episode.episodeKey} ${status}: ${qty} @ ${avgPrice} (P&L: ${realizedPnL})`;
}
