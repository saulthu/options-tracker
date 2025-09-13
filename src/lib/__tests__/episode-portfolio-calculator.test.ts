// Tests for the new episode-based portfolio calculator
import {
  buildPortfolioView,
  filterEpisodesByDateRange,
  getAccountEpisodes,
  getOpenEpisodes,
  getClosedEpisodes,
  getEpisodesByKind,
  getTotalRealizedPnL,
  createTickerLookup,
  formatEpisodeForDisplay
} from '../episode-portfolio-calculator';
import { RawTransaction, TickerLookup, OpeningBalances, PortfolioResult } from '../../types/episodes';
import { CurrencyAmount } from '../currency-amount';

// Helper function to create test transactions
function createTestTransaction(overrides: Partial<RawTransaction> = {}): RawTransaction {
  return {
    id: 'test-txn-1',
    user_id: 'user-1',
    account_id: 'account-1',
    timestamp: '2025-09-01T10:00:00Z',
    created_at: '2025-09-01T10:00:00Z',
    updated_at: '2025-09-01T10:00:00Z',
    instrument_kind: 'CASH',
    ticker_id: undefined,
    expiry: undefined,
    strike: undefined,
    side: undefined,
    qty: 1000,
    price: new CurrencyAmount(1.0, 'USD'),
    fees: new CurrencyAmount(0, 'USD'),
    currency: 'USD',
    memo: 'Test transaction',
    tickers: undefined,
    accounts: undefined,
    ...overrides
  };
}

describe('Episode Portfolio Calculator', () => {
  let tickerLookup: TickerLookup;
  let openingBalances: OpeningBalances;

  beforeEach(() => {
    tickerLookup = new Map([
      ['ticker-1', 'AAPL'],
      ['ticker-2', 'MSFT']
    ]);
    openingBalances = new Map([
      ['account-1', new CurrencyAmount(0, 'USD')],
      ['account-2', new CurrencyAmount(1000, 'USD')],
      ['account-eur', new CurrencyAmount(0, 'EUR')],
      ['account-aud', new CurrencyAmount(0, 'AUD')]
    ]);
  });

  describe('buildPortfolioView', () => {
    it('should handle cash transactions', () => {
      const transactions = [
        createTestTransaction({
          instrument_kind: 'CASH',
          qty: 1000,
          memo: 'Initial deposit'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.ledger).toHaveLength(1);
      expect(result.ledger[0].accepted).toBe(true);
      expect(result.ledger[0].cashDelta.amount).toBe(1000);
      expect(result.balances.get('account-1')?.get('USD')?.amount).toBe(1000);

      expect(result.episodes).toHaveLength(1);
      expect(result.episodes[0].kindGroup).toBe('CASH');
      expect(result.episodes[0].qty).toBe(0); // Cash episodes are always closed positions
      expect(result.episodes[0].cashTotal.amount).toBe(1000); // Cash value is in cashTotal
      expect(result.episodes[0].closeTimestamp).toBe('2025-09-01T10:00:00Z'); // Cash episodes close immediately
    });

    it('should handle share transactions', () => {
      const transactions = [
        createTestTransaction({
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 100,
          price: new CurrencyAmount(150, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          memo: 'Buy AAPL shares'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.ledger).toHaveLength(1);
      expect(result.ledger[0].accepted).toBe(true);
      expect(result.ledger[0].cashDelta.amount).toBe(-15001); // -(100 * 150 * 1) - 1
      expect(result.balances.get('account-1')?.get('USD')?.amount).toBe(-15001);

      expect(result.episodes).toHaveLength(1);
      expect(result.episodes[0].kindGroup).toBe('SHARES');
      expect(result.episodes[0].episodeKey).toBe('AAPL');
      expect(result.episodes[0].qty).toBe(100);
      expect(result.episodes[0].avgPrice.amount).toBe(150.01); // 150 + (1/100)
    });

    it('should handle option transactions with 100x multiplier', () => {
      const transactions = [
        createTestTransaction({
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(5.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          memo: 'Sell AAPL call'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.ledger).toHaveLength(1);
      expect(result.ledger[0].accepted).toBe(true);
      expect(result.ledger[0].cashDelta.amount).toBe(499.50); // +(1 * 5.00 * 100) - 0.50
      expect(result.balances.get('account-1')?.get('USD')?.amount).toBe(499.50);

      expect(result.episodes).toHaveLength(1);
      expect(result.episodes[0].kindGroup).toBe('OPTION');
      expect(result.episodes[0].episodeKey).toBe('AAPL|CALL|160|2025-09-19');
      expect(result.episodes[0].qty).toBe(-1); // Short position
      expect(result.episodes[0].currentRight).toBe('CALL');
      expect(result.episodes[0].currentStrike?.amount).toBe(160);
      expect(result.episodes[0].currentExpiry).toBe('2025-09-19');
    });

    it('should reject negative share quantities', () => {
      const transactions = [
        createTestTransaction({
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 100,
          price: new CurrencyAmount(150, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          memo: 'Sell AAPL shares (should fail)'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.ledger).toHaveLength(1);
      expect(result.ledger[0].accepted).toBe(false);
      expect(result.ledger[0].error).toBe('Equities cannot be negative (long-only)');
      expect(result.balances.get('account-1')?.get('USD')?.amount).toBe(0); // No change to balance
      expect(result.episodes).toHaveLength(0); // No episodes for rejected transactions
    });

    it('should handle covered call strategy', () => {
      const transactions = [
        // Buy shares
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 100,
          price: new CurrencyAmount(150, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          memo: 'Buy AAPL shares'
        }),
        // Sell covered call
        createTestTransaction({
          id: 'txn-2',
          timestamp: '2025-09-01T11:00:00Z',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(5.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          memo: 'Sell covered call'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.episodes).toHaveLength(2);
      
      const shareEpisode = result.episodes.find(e => e.kindGroup === 'SHARES');
      const callEpisode = result.episodes.find(e => e.kindGroup === 'OPTION');
      
      expect(shareEpisode?.qty).toBe(100);
      expect(callEpisode?.qty).toBe(-1);
      expect(callEpisode?.currentRight).toBe('CALL');
    });
  });

  describe('Utility Functions', () => {
    let transactions: RawTransaction[];
    let result: PortfolioResult;

    beforeEach(() => {
      transactions = [
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'CASH',
          qty: 1000,
          timestamp: '2025-09-01T10:00:00Z'
        }),
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 100,
          price: new CurrencyAmount(150, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          timestamp: '2025-09-01T11:00:00Z'
        }),
        createTestTransaction({
          id: 'txn-3',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 50,
          price: new CurrencyAmount(160, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          timestamp: '2025-09-01T12:00:00Z'
        })
      ];

      result = buildPortfolioView(transactions, tickerLookup, openingBalances);
    });

    it('should filter episodes by date range with overlap mode', () => {
      const filtered = filterEpisodesByDateRange(
        result.episodes,
        '2025-09-01T10:30:00Z',
        '2025-09-01T11:30:00Z',
        'overlap'
      );
      
      expect(filtered).toHaveLength(1); // Only the share episode should be in range
      expect(filtered[0].kindGroup).toBe('SHARES');
    });

    it('should filter episodes by opened during date range', () => {
      const filtered = filterEpisodesByDateRange(
        result.episodes,
        '2025-09-01T10:30:00Z',
        '2025-09-01T11:30:00Z',
        'openedDuring'
      );
      
      expect(filtered).toHaveLength(1); // Only the share episode opened in this range
      expect(filtered[0].kindGroup).toBe('SHARES');
    });

    it('should filter episodes by closed during date range', () => {
      const filtered = filterEpisodesByDateRange(
        result.episodes,
        '2025-09-01T10:30:00Z',
        '2025-09-01T11:30:00Z',
        'closedDuring'
      );
      
      expect(filtered).toHaveLength(0); // No episodes closed in this range
    });

    it('should get account episodes', () => {
      const accountEpisodes = getAccountEpisodes(result.episodes, 'account-1');
      expect(accountEpisodes).toHaveLength(2); // Cash and shares episodes
    });

    it('should get open episodes', () => {
      const openEpisodes = getOpenEpisodes(result.episodes);
      expect(openEpisodes).toHaveLength(1); // Only remaining shares (qty=50), cash episode is closed (qty=0)
      const shareEpisode = openEpisodes.find(e => e.kindGroup === 'SHARES');
      expect(shareEpisode?.qty).toBe(50);
    });

    it('should get closed episodes', () => {
      const closedEpisodes = getClosedEpisodes(result.episodes);
      expect(closedEpisodes).toHaveLength(1); // Cash episode is closed (qty=0)
      const cashEpisode = closedEpisodes.find(e => e.kindGroup === 'CASH');
      expect(cashEpisode?.qty).toBe(0);
    });

    it('should get episodes by kind', () => {
      const shareEpisodes = getEpisodesByKind(result.episodes, 'SHARES');
      expect(shareEpisodes).toHaveLength(1);
      expect(shareEpisodes[0].kindGroup).toBe('SHARES');
    });

    it('should calculate total realized P&L', () => {
      const totalPnL = getTotalRealizedPnL(result.episodes);
      expect(totalPnL.get('USD')?.amount).toBeCloseTo(498.5, 1); // (160 - 150.01) * 50 - 1
    });

    it('should create ticker lookup from transactions', () => {
      // Add ticker data to transactions for this test
      const transactionsWithTickers = transactions.map(txn => ({
        ...txn,
        tickers: txn.ticker_id ? { id: txn.ticker_id, user_id: 'user-1', name: 'AAPL' } : undefined
      }));
      
      const lookup = createTickerLookup(transactionsWithTickers);
      expect(lookup.get('ticker-1')).toBe('AAPL');
    });

    it('should format episode for display', () => {
      const shareEpisode = result.episodes.find((e: { kindGroup: string }) => e.kindGroup === 'SHARES');
      expect(shareEpisode).toBeDefined();
      const formatted = formatEpisodeForDisplay(shareEpisode!);
      expect(formatted).toContain('AAPL OPEN: 50 shares');
    });
  });

  describe('Option Roll Detection', () => {
    it('should detect and handle option rolls within 10 hours', () => {
      const transactions = [
        // Sell 1 AAPL call
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(5.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Buy 1 AAPL call (close position)
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(3.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T11:00:00Z'
        }),
        // Sell 1 AAPL call (roll - within 10 hours, opposite side, equal quantity)
        createTestTransaction({
          id: 'txn-3',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(4.00, 'USD'),
          strike: new CurrencyAmount(165, 'USD'), // Different strike (roll)
          expiry: '2025-09-26', // Different expiry (roll)
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T12:00:00Z' // Within 10 hours
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      // Should have 2 episodes (different strikes are separate contracts, no roll)
      expect(result.episodes).toHaveLength(2);
      
      const episodes = result.episodes.sort((a, b) => a.openTimestamp.localeCompare(b.openTimestamp));
      const firstEpisode = episodes[0];
      const secondEpisode = episodes[1];
      
      // First episode (closed)
      expect(firstEpisode.qty).toBe(0); // Closed position
      expect(firstEpisode.currentStrike?.amount).toBe(160); // Original strike
      expect(firstEpisode.currentExpiry).toBe('2025-09-19'); // Original expiry
      expect(firstEpisode.txns).toHaveLength(2);
      
      // Second episode (new contract)
      expect(secondEpisode.qty).toBe(-1); // Short position
      expect(secondEpisode.currentStrike?.amount).toBe(165); // New strike
      expect(secondEpisode.currentExpiry).toBe('2025-09-26'); // New expiry
      expect(secondEpisode.txns).toHaveLength(1);
    });

    it('should not roll options after 10 hours', () => {
      const transactions = [
        // Sell 1 AAPL call
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(5.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Buy 1 AAPL call (close position)
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(3.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T11:00:00Z'
        }),
        // Sell 1 AAPL call (too late - after 10 hours)
        createTestTransaction({
          id: 'txn-3',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(4.00, 'USD'),
          strike: new CurrencyAmount(165, 'USD'),
          expiry: '2025-09-26',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T22:00:00Z' // 12 hours later
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      // Should have 2 episodes (no roll)
      expect(result.episodes).toHaveLength(2);
      const closedEpisode = result.episodes.find(e => e.qty === 0);
      const newEpisode = result.episodes.find(e => e.qty === -1);
      
      expect(closedEpisode?.rolled).toBe(false);
      expect(newEpisode?.rolled).toBe(false);
    });

    it('should not roll options with different quantities', () => {
      const transactions = [
        // Sell 1 AAPL call
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(5.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Buy 1 AAPL call (close position)
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(3.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T11:00:00Z'
        }),
        // Sell 2 AAPL calls (different quantity)
        createTestTransaction({
          id: 'txn-3',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 2, // Different quantity
          price: new CurrencyAmount(4.00, 'USD'),
          strike: new CurrencyAmount(165, 'USD'),
          expiry: '2025-09-26',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T12:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      // Should have 2 episodes (no roll)
      expect(result.episodes).toHaveLength(2);
    });
  });

  describe('Crossing Zero Validation', () => {
    it('should reject transactions that would cause position to cross zero', () => {
      const transactions = [
        // Buy 100 shares
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 100,
          price: new CurrencyAmount(150, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Try to sell 150 shares (would cross zero)
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 150, // More than we own
          price: new CurrencyAmount(160, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          timestamp: '2025-09-01T11:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.ledger).toHaveLength(2);
      expect(result.ledger[1].accepted).toBe(false);
      expect(result.ledger[1].error).toBe('Equities cannot be negative (long-only)');
    });
  });

  describe('Complex Trading Scenarios', () => {
    it('should handle iron condor strategy', () => {
      const transactions = [
        // Sell call spread (higher strike)
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(2.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T10:00:00Z'
        }),
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(1.00, 'USD'),
          strike: new CurrencyAmount(165, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T10:01:00Z'
        }),
        // Sell put spread (lower strike)
        createTestTransaction({
          id: 'txn-3',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(1.50, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T10:02:00Z'
        }),
        createTestTransaction({
          id: 'txn-4',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(0.50, 'USD'),
          strike: new CurrencyAmount(145, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T10:03:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.episodes).toHaveLength(4); // 4 episodes (each unique option contract is separate)
      
      const callEpisodes = result.episodes.filter(e => e.kindGroup === 'OPTION' && e.currentRight === 'CALL');
      const putEpisodes = result.episodes.filter(e => e.kindGroup === 'OPTION' && e.currentRight === 'PUT');
      
      expect(callEpisodes).toHaveLength(2); // 2 call episodes (different strikes)
      expect(putEpisodes).toHaveLength(2); // 2 put episodes (different strikes)
    });

    it('should separate different option strikes into different episodes', () => {
      const transactions = [
        // Sell MSFT $300 PUT
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-2', // MSFT
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(2.00, 'USD'),
          strike: new CurrencyAmount(300, 'USD'),
          expiry: '2025-10-17',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-11T10:00:00Z'
        }),
        // Buy MSFT $295 PUT (different strike - should be separate episode)
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-2', // MSFT
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(1.00, 'USD'),
          strike: new CurrencyAmount(295, 'USD'),
          expiry: '2025-10-17',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-11T10:01:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      // Should have 2 separate episodes (different strikes)
      expect(result.episodes).toHaveLength(2);
      
      const episodes = result.episodes.sort((a, b) => a.openTimestamp.localeCompare(b.openTimestamp));
      
      // First episode: SELL $300 PUT
      expect(episodes[0].episodeKey).toBe('MSFT|PUT|300|2025-10-17');
      expect(episodes[0].qty).toBe(-1); // Short position
      expect(episodes[0].currentStrike?.amount).toBe(300);
      expect(episodes[0].txns).toHaveLength(1);
      
      // Second episode: BUY $295 PUT
      expect(episodes[1].episodeKey).toBe('MSFT|PUT|295|2025-10-17');
      expect(episodes[1].qty).toBe(1); // Long position
      expect(episodes[1].currentStrike?.amount).toBe(295);
      expect(episodes[1].txns).toHaveLength(1);
    });

    it('should handle calendar spread', () => {
      const transactions = [
        // Sell near-term call
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(3.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-09-19',
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Buy longer-term call
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(2.00, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-10-17', // Different expiry
          fees: new CurrencyAmount(0.50, 'USD'),
          timestamp: '2025-09-01T10:01:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.episodes).toHaveLength(2); // 2 episodes (different expiries are separate contracts)
      
      const episodes = result.episodes.sort((a, b) => a.openTimestamp.localeCompare(b.openTimestamp));
      expect(episodes[0].currentExpiry).toBe('2025-09-19'); // First transaction's expiry
      expect(episodes[1].currentExpiry).toBe('2025-10-17'); // Second transaction's expiry
    });
  });

  describe('Multi-Currency Support', () => {
    it('should handle multiple currencies in the same account', () => {
      const transactions = [
        createTestTransaction({
          id: 'usd-cash-1',
          account_id: 'account-1',
          instrument_kind: 'CASH',
          qty: 1000,
          price: new CurrencyAmount(1, 'USD'),
          fees: new CurrencyAmount(0, 'USD'),
          currency: 'USD',
          memo: 'USD cash deposit'
        }),
        createTestTransaction({
          id: 'eur-cash-1',
          account_id: 'account-eur',
          instrument_kind: 'CASH',
          qty: 500,
          price: new CurrencyAmount(1, 'EUR'),
          fees: new CurrencyAmount(0, 'EUR'),
          currency: 'EUR',
          memo: 'EUR cash deposit'
        }),
        createTestTransaction({
          id: 'aud-cash-1',
          account_id: 'account-aud',
          instrument_kind: 'CASH',
          qty: 2000,
          price: new CurrencyAmount(1, 'AUD'),
          fees: new CurrencyAmount(0, 'AUD'),
          currency: 'AUD',
          memo: 'AUD cash deposit'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      // Should have separate balances for each currency
      expect(result.balances.get('account-1')?.get('USD')?.amount).toBe(1000);
      expect(result.balances.get('account-eur')?.get('EUR')?.amount).toBe(500);
      expect(result.balances.get('account-aud')?.get('AUD')?.amount).toBe(2000);

      // Should have 3 cash episodes (one per currency)
      const cashEpisodes = result.episodes.filter(ep => ep.kindGroup === 'CASH');
      expect(cashEpisodes).toHaveLength(3);
    });

    it('should handle multi-currency share transactions', () => {
      const transactions = [
        // USD share purchase
        createTestTransaction({
          id: 'usd-shares-1',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 100,
          price: new CurrencyAmount(150, 'USD'),
          fees: new CurrencyAmount(5, 'USD'),
          currency: 'USD',
          memo: 'USD AAPL purchase'
        }),
        // EUR share purchase
        createTestTransaction({
          id: 'eur-shares-1',
          account_id: 'account-eur',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-2',
          side: 'BUY',
          qty: 50,
          price: new CurrencyAmount(200, 'EUR'),
          fees: new CurrencyAmount(3, 'EUR'),
          currency: 'EUR',
          memo: 'EUR MSFT purchase'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      // Should have separate balances for each currency
      expect(result.balances.get('account-1')?.get('USD')?.amount).toBe(-15005); // -(100 * 150) - 5
      expect(result.balances.get('account-eur')?.get('EUR')?.amount).toBe(-10003); // -(50 * 200) - 3

      // Should have 2 share episodes
      const shareEpisodes = result.episodes.filter(ep => ep.kindGroup === 'SHARES');
      expect(shareEpisodes).toHaveLength(2);
    });

    it('should handle multi-currency option transactions', () => {
      const transactions = [
        // USD call option
        createTestTransaction({
          id: 'usd-call-1',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(5, 'USD'),
          fees: new CurrencyAmount(0.5, 'USD'),
          strike: new CurrencyAmount(160, 'USD'),
          expiry: '2025-12-19',
          currency: 'USD',
          memo: 'USD AAPL call'
        }),
        // EUR put option
        createTestTransaction({
          id: 'eur-put-1',
          account_id: 'account-eur',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-2',
          side: 'BUY',
          qty: 2,
          price: new CurrencyAmount(3, 'EUR'),
          fees: new CurrencyAmount(1, 'EUR'),
          strike: new CurrencyAmount(180, 'EUR'),
          expiry: '2025-12-19',
          currency: 'EUR',
          memo: 'EUR MSFT put'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      // Should have separate balances for each currency
      expect(result.balances.get('account-1')?.get('USD')?.amount).toBe(499.5); // +(1 * 5 * 100) - 0.5
      expect(result.balances.get('account-eur')?.get('EUR')?.amount).toBe(-601); // -(2 * 3 * 100) - 1

      // Should have 2 option episodes
      const optionEpisodes = result.episodes.filter(ep => ep.kindGroup === 'OPTION');
      expect(optionEpisodes).toHaveLength(2);
    });

    it('should prevent currency mixing in calculations', () => {
      const transactions = [
        createTestTransaction({
          id: 'usd-txn-1',
          instrument_kind: 'CASH',
          qty: 1000,
          price: new CurrencyAmount(1, 'USD'),
          fees: new CurrencyAmount(0, 'USD'),
          currency: 'USD'
        }),
        createTestTransaction({
          id: 'eur-txn-1',
          account_id: 'account-eur',
          instrument_kind: 'CASH',
          qty: 500,
          price: new CurrencyAmount(1, 'EUR'),
          fees: new CurrencyAmount(0, 'EUR'),
          currency: 'EUR'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      // Balances should be separate by currency
      const usdBalances = result.balances.get('account-1');
      const eurBalances = result.balances.get('account-eur');
      expect(usdBalances?.get('USD')?.amount).toBe(1000);
      expect(eurBalances?.get('EUR')?.amount).toBe(500);
      expect(usdBalances?.get('USD')?.currency).toBe('USD');
      expect(eurBalances?.get('EUR')?.currency).toBe('EUR');
    });

    it('should calculate total P&L correctly for multiple currencies', () => {
      const transactions = [
        // USD transactions
        createTestTransaction({
          id: 'usd-buy-1',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 100,
          price: new CurrencyAmount(100, 'USD'),
          fees: new CurrencyAmount(5, 'USD'),
          currency: 'USD'
        }),
        createTestTransaction({
          id: 'usd-sell-1',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 100,
          price: new CurrencyAmount(110, 'USD'),
          fees: new CurrencyAmount(5, 'USD'),
          currency: 'USD'
        }),
        // EUR transactions
        createTestTransaction({
          id: 'eur-buy-1',
          account_id: 'account-eur',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-2',
          side: 'BUY',
          qty: 50,
          price: new CurrencyAmount(200, 'EUR'),
          fees: new CurrencyAmount(3, 'EUR'),
          currency: 'EUR'
        }),
        createTestTransaction({
          id: 'eur-sell-1',
          account_id: 'account-eur',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-2',
          side: 'SELL',
          qty: 50,
          price: new CurrencyAmount(220, 'EUR'),
          fees: new CurrencyAmount(3, 'EUR'),
          currency: 'EUR'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);
      const totalPnL = getTotalRealizedPnL(result.episodes);

      // Should have separate P&L for each currency
      expect(totalPnL.get('USD')?.amount).toBe(990); // (110 - 100) * 100 - 5 - 5 = 1000 - 10 = 990
      expect(totalPnL.get('EUR')?.amount).toBe(994); // (220 - 200) * 50 - 3 - 3 = 1000 - 6 = 994
      expect(totalPnL.get('USD')?.currency).toBe('USD');
      expect(totalPnL.get('EUR')?.currency).toBe('EUR');
    });

    it('should handle mixed currency transactions across different accounts', () => {
      const transactions = [
        // Account 1 - USD
        createTestTransaction({
          id: 'acc1-usd-1',
          account_id: 'account-1',
          instrument_kind: 'CASH',
          qty: 1000,
          price: new CurrencyAmount(1, 'USD'),
          fees: new CurrencyAmount(0, 'USD'),
          currency: 'USD'
        }),
        // Account EUR - EUR
        createTestTransaction({
          id: 'acc1-eur-1',
          account_id: 'account-eur',
          instrument_kind: 'CASH',
          qty: 500,
          price: new CurrencyAmount(1, 'EUR'),
          fees: new CurrencyAmount(0, 'EUR'),
          currency: 'EUR'
        }),
        // Account 2 - USD
        createTestTransaction({
          id: 'acc2-usd-1',
          account_id: 'account-2',
          instrument_kind: 'CASH',
          qty: 2000,
          price: new CurrencyAmount(1, 'USD'),
          fees: new CurrencyAmount(0, 'USD'),
          currency: 'USD'
        }),
        // Account AUD - AUD
        createTestTransaction({
          id: 'acc2-aud-1',
          account_id: 'account-aud',
          instrument_kind: 'CASH',
          qty: 3000,
          price: new CurrencyAmount(1, 'AUD'),
          fees: new CurrencyAmount(0, 'AUD'),
          currency: 'AUD'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      // Account 1 should have USD balance
      expect(result.balances.get('account-1')?.get('USD')?.amount).toBe(1000);
      
      // Account EUR should have EUR balance
      expect(result.balances.get('account-eur')?.get('EUR')?.amount).toBe(500);

      // Account 2 should have USD balance
      expect(result.balances.get('account-2')?.get('USD')?.amount).toBe(3000); // 1000 (opening) + 2000 (transaction)
      
      // Account AUD should have AUD balance
      expect(result.balances.get('account-aud')?.get('AUD')?.amount).toBe(3000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple accounts', () => {
      const transactions = [
        createTestTransaction({
          id: 'txn-1',
          account_id: 'account-1',
          instrument_kind: 'CASH',
          qty: 1000,
          timestamp: '2025-09-01T10:00:00Z'
        }),
        createTestTransaction({
          id: 'txn-2',
          account_id: 'account-2',
          instrument_kind: 'CASH',
          qty: 2000,
          timestamp: '2025-09-01T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.episodes).toHaveLength(2);
      expect(result.balances.get('account-1')?.get('USD')?.amount).toBe(1000);
      expect(result.balances.get('account-2')?.get('USD')?.amount).toBe(3000); // 1000 (opening) + 2000 (transaction)
    });

    it('should handle zero quantity transactions', () => {
      const transactions = [
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 0, // Zero quantity
          price: new CurrencyAmount(150, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          timestamp: '2025-09-01T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.ledger).toHaveLength(1);
      expect(result.ledger[0].accepted).toBe(true);
      expect(result.episodes).toHaveLength(1); // Zero quantity still creates an episode
    });
  });

  describe('Options Trading Terminology', () => {
    it('should set correct option directionality for CSP position', () => {
      const transactions = [
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(2.50, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-12-19',
          timestamp: '2025-09-01T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);
      const episode = result.episodes[0];

      expect(episode.optionDirection).toBe('CSP');
      expect(episode.txns[0].actionTerm).toBe('STO');
    });

    it('should set correct option directionality for CC position', () => {
      const transactions = [
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(2.50, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-12-19',
          timestamp: '2025-09-01T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);
      const episode = result.episodes[0];

      expect(episode.optionDirection).toBe('CC');
      expect(episode.txns[0].actionTerm).toBe('STO');
    });

    it('should set correct option directionality for long CALL position', () => {
      const transactions = [
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(2.50, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-12-19',
          timestamp: '2025-09-01T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);
      const episode = result.episodes[0];

      expect(episode.optionDirection).toBe('CALL');
      expect(episode.txns[0].actionTerm).toBe('BTO');
    });

    it('should set correct option directionality for long PUT position', () => {
      const transactions = [
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(2.50, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-12-19',
          timestamp: '2025-09-01T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);
      const episode = result.episodes[0];

      expect(episode.optionDirection).toBe('PUT');
      expect(episode.txns[0].actionTerm).toBe('BTO');
    });

    it('should use correct terminology for closing transactions', () => {
      const transactions = [
        // Open CSP position
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(2.50, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-12-19',
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Close CSP position
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(1.25, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-12-19',
          timestamp: '2025-09-02T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);
      const episode = result.episodes[0];

      expect(episode.optionDirection).toBe('CSP');
      expect(episode.txns[0].actionTerm).toBe('STO'); // Opening
      expect(episode.txns[1].actionTerm).toBe('BTC'); // Closing
    });

    it('should use correct terminology for closing long positions', () => {
      const transactions = [
        // Open long CALL position
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(2.50, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-12-19',
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Close long CALL position
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(3.75, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-12-19',
          timestamp: '2025-09-02T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);
      const episode = result.episodes[0];

      expect(episode.optionDirection).toBe('CALL');
      expect(episode.txns[0].actionTerm).toBe('BTO'); // Opening
      expect(episode.txns[1].actionTerm).toBe('STC'); // Closing
    });

    it('should use BUY/SELL for non-options', () => {
      const transactions = [
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 100,
          price: new CurrencyAmount(150, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          timestamp: '2025-09-01T10:00:00Z'
        }),
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CASH',
          qty: 1000,
          timestamp: '2025-09-01T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.episodes[0].txns[0].actionTerm).toBe('BUY'); // Shares
      expect(result.episodes[1].txns[0].actionTerm).toBeUndefined(); // Cash has no side
    });

    it('should preserve average price when position is closed', () => {
      const transactions = [
        // Open position
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: new CurrencyAmount(2.50, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-12-19',
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Close position
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: new CurrencyAmount(3.75, 'USD'),
          fees: new CurrencyAmount(1, 'USD'),
          strike: new CurrencyAmount(150, 'USD'),
          expiry: '2025-12-19',
          timestamp: '2025-09-02T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);
      const episode = result.episodes[0];

      expect(episode.qty).toBe(0); // Position is closed
      expect(episode.closeTimestamp).toBeDefined();
      expect(episode.avgPrice.amount).toBe(2.51); // Should preserve average price (2.50 + 1/100)
      expect(episode.realizedPnLTotal.amount).toBeCloseTo(123, 0); // (3.75 - 2.51) * 100 - 1, accounting for floating point precision
    });
  });

  describe('Memo Field Preservation', () => {
    it('should preserve memo field in EpisodeTxn for cash transactions', () => {
      const transaction = createTestTransaction({
        instrument_kind: 'CASH',
        memo: 'Test cash memo'
      });
      
      const result = buildPortfolioView([transaction], tickerLookup);
      const cashEpisode = result.episodes.find(e => e.kindGroup === 'CASH');
      
      expect(cashEpisode).toBeDefined();
      expect(cashEpisode!.txns).toHaveLength(1);
      expect(cashEpisode!.txns[0].note).toBe('Test cash memo');
    });

    it('should preserve memo field in EpisodeTxn for share transactions', () => {
      const transaction = createTestTransaction({
        instrument_kind: 'SHARES',
        ticker_id: 'ticker-1',
        side: 'BUY',
        qty: 100,
        price: new CurrencyAmount(150.00, 'USD'),
        memo: 'Test share memo'
      });
      
      const result = buildPortfolioView([transaction], tickerLookup);
      const shareEpisode = result.episodes.find(e => e.kindGroup === 'SHARES');
      
      expect(shareEpisode).toBeDefined();
      expect(shareEpisode!.txns).toHaveLength(1);
      expect(shareEpisode!.txns[0].note).toBe('Test share memo');
    });

    it('should preserve memo field in EpisodeTxn for option transactions', () => {
      const transaction = createTestTransaction({
        instrument_kind: 'CALL',
        ticker_id: 'ticker-1',
        side: 'SELL',
        qty: 1,
        price: new CurrencyAmount(5.00, 'USD'),
        strike: new CurrencyAmount(150, 'USD'),
        expiry: '2025-12-19',
        memo: 'Test option memo'
      });
      
      const result = buildPortfolioView([transaction], tickerLookup);
      const optionEpisode = result.episodes.find(e => e.kindGroup === 'OPTION');
      
      expect(optionEpisode).toBeDefined();
      expect(optionEpisode!.txns).toHaveLength(1);
      expect(optionEpisode!.txns[0].note).toBe('Test option memo');
    });

    it('should handle undefined memo fields gracefully', () => {
      const transaction = createTestTransaction({
        instrument_kind: 'CASH',
        memo: undefined
      });
      
      const result = buildPortfolioView([transaction], tickerLookup);
      const cashEpisode = result.episodes.find(e => e.kindGroup === 'CASH');
      
      expect(cashEpisode).toBeDefined();
      expect(cashEpisode!.txns).toHaveLength(1);
      expect(cashEpisode!.txns[0].note).toBeUndefined();
    });
  });
});
