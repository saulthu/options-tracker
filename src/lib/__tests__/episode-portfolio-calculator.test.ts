// Tests for the new episode-based portfolio calculator
import {
  buildPortfolioView,
  filterEpisodesByDateRange,
  getAccountEpisodes,
  getOpenEpisodes,
  getClosedEpisodes,
  getEpisodesByKind,
  getTotalRealizedPnL,
  // getAccountRealizedPnL,
  createTickerLookup,
  formatEpisodeForDisplay
} from '../episode-portfolio-calculator';
import { RawTransaction, TickerLookup, OpeningBalances, PortfolioResult } from '../../types/episodes';

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
    price: undefined,
    fees: 0,
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
      ['account-1', 0],
      ['account-2', 1000]
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
      expect(result.ledger[0].cashDelta).toBe(1000);
      expect(result.balances.get('account-1')).toBe(1000);

      expect(result.episodes).toHaveLength(1);
      expect(result.episodes[0].kindGroup).toBe('CASH');
      expect(result.episodes[0].qty).toBe(1000);
      expect(result.episodes[0].closeTimestamp).toBe('2025-09-01T10:00:00Z'); // Cash episodes close immediately
    });

    it('should handle share transactions', () => {
      const transactions = [
        createTestTransaction({
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 100,
          price: 150,
          fees: 1,
          memo: 'Buy AAPL shares'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.ledger).toHaveLength(1);
      expect(result.ledger[0].accepted).toBe(true);
      expect(result.ledger[0].cashDelta).toBe(-15001); // -(100 * 150 * 1) - 1
      expect(result.balances.get('account-1')).toBe(-15001);

      expect(result.episodes).toHaveLength(1);
      expect(result.episodes[0].kindGroup).toBe('SHARES');
      expect(result.episodes[0].episodeKey).toBe('AAPL');
      expect(result.episodes[0].qty).toBe(100);
      expect(result.episodes[0].avgPrice).toBe(150.01); // 150 + (1/100)
    });

    it('should handle option transactions with 100x multiplier', () => {
      const transactions = [
        createTestTransaction({
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: 5.00,
          strike: 160,
          expiry: '2025-09-19',
          fees: 0.50,
          memo: 'Sell AAPL call'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.ledger).toHaveLength(1);
      expect(result.ledger[0].accepted).toBe(true);
      expect(result.ledger[0].cashDelta).toBe(499.50); // +(1 * 5.00 * 100) - 0.50
      expect(result.balances.get('account-1')).toBe(499.50);

      expect(result.episodes).toHaveLength(1);
      expect(result.episodes[0].kindGroup).toBe('OPTION');
      expect(result.episodes[0].episodeKey).toBe('AAPL|CALL');
      expect(result.episodes[0].qty).toBe(-1); // Short position
      expect(result.episodes[0].currentRight).toBe('CALL');
      expect(result.episodes[0].currentStrike).toBe(160);
      expect(result.episodes[0].currentExpiry).toBe('2025-09-19');
    });

    it('should reject negative share quantities', () => {
      const transactions = [
        createTestTransaction({
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 100,
          price: 150,
          fees: 1,
          memo: 'Sell AAPL shares (should fail)'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.ledger).toHaveLength(1);
      expect(result.ledger[0].accepted).toBe(false);
      expect(result.ledger[0].error).toBe('Equities cannot be negative (long-only)');
      expect(result.balances.get('account-1')).toBe(0); // No change to balance
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
          price: 150,
          fees: 1,
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
          price: 5.00,
          strike: 160,
          expiry: '2025-09-19',
          fees: 0.50,
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
          price: 150,
          fees: 1,
          timestamp: '2025-09-01T11:00:00Z'
        }),
        createTestTransaction({
          id: 'txn-3',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 50,
          price: 160,
          fees: 1,
          timestamp: '2025-09-01T12:00:00Z'
        })
      ];

      result = buildPortfolioView(transactions, tickerLookup, openingBalances);
    });

    it('should filter episodes by date range', () => {
      const filtered = filterEpisodesByDateRange(
        result.episodes,
        '2025-09-01T10:30:00Z',
        '2025-09-01T11:30:00Z'
      );
      
      expect(filtered).toHaveLength(1); // Only the share episode should be in range
      expect(filtered[0].kindGroup).toBe('SHARES');
    });

    it('should get account episodes', () => {
      const accountEpisodes = getAccountEpisodes(result.episodes, 'account-1');
      expect(accountEpisodes).toHaveLength(2); // Cash and shares episodes
    });

    it('should get open episodes', () => {
      const openEpisodes = getOpenEpisodes(result.episodes);
      expect(openEpisodes).toHaveLength(2); // Cash episode (qty=1000) and remaining shares (qty=50)
      const shareEpisode = openEpisodes.find(e => e.kindGroup === 'SHARES');
      expect(shareEpisode?.qty).toBe(50);
    });

    it('should get closed episodes', () => {
      const closedEpisodes = getClosedEpisodes(result.episodes);
      expect(closedEpisodes).toHaveLength(0); // No episodes are closed (qty=0)
    });

    it('should get episodes by kind', () => {
      const shareEpisodes = getEpisodesByKind(result.episodes, 'SHARES');
      expect(shareEpisodes).toHaveLength(1);
      expect(shareEpisodes[0].kindGroup).toBe('SHARES');
    });

    it('should calculate total realized P&L', () => {
      const totalPnL = getTotalRealizedPnL(result.episodes);
      expect(totalPnL).toBeCloseTo(498.5, 1); // (160 - 150.01) * 50 - 1
    });

    it('should create ticker lookup from transactions', () => {
      // Add ticker data to transactions for this test
      const transactionsWithTickers = transactions.map(txn => ({
        ...txn,
        tickers: txn.ticker_id ? { id: txn.ticker_id, name: 'AAPL' } : undefined
      }));
      
      const lookup = createTickerLookup(transactionsWithTickers);
      expect(lookup.get('ticker-1')).toBe('AAPL');
    });

    it('should format episode for display', () => {
      const shareEpisode = result.episodes.find((e: { kindGroup: string }) => e.kindGroup === 'SHARES');
      const formatted = formatEpisodeForDisplay(shareEpisode);
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
          price: 5.00,
          strike: 160,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Buy 1 AAPL call (close position)
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: 3.00,
          strike: 160,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T11:00:00Z'
        }),
        // Sell 1 AAPL call (roll - within 10 hours, opposite side, equal quantity)
        createTestTransaction({
          id: 'txn-3',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: 4.00,
          strike: 165, // Different strike (roll)
          expiry: '2025-09-26', // Different expiry (roll)
          fees: 0.50,
          timestamp: '2025-09-01T12:00:00Z' // Within 10 hours
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      // Should have only 1 episode (rolled)
      expect(result.episodes).toHaveLength(1);
      const episode = result.episodes[0];
      
      expect(episode.rolled).toBe(true);
      expect(episode.qty).toBe(-1); // Short position
      expect(episode.currentStrike).toBe(165); // New strike
      expect(episode.currentExpiry).toBe('2025-09-26'); // New expiry
      expect(episode.txns).toHaveLength(3);
      expect(episode.txns[1].note).toBe('ROLL-CLOSE');
      expect(episode.txns[2].note).toBe('ROLL-OPEN');
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
          price: 5.00,
          strike: 160,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Buy 1 AAPL call (close position)
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: 3.00,
          strike: 160,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T11:00:00Z'
        }),
        // Sell 1 AAPL call (too late - after 10 hours)
        createTestTransaction({
          id: 'txn-3',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: 4.00,
          strike: 165,
          expiry: '2025-09-26',
          fees: 0.50,
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
          price: 5.00,
          strike: 160,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Buy 1 AAPL call (close position)
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: 3.00,
          strike: 160,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T11:00:00Z'
        }),
        // Sell 2 AAPL calls (different quantity)
        createTestTransaction({
          id: 'txn-3',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 2, // Different quantity
          price: 4.00,
          strike: 165,
          expiry: '2025-09-26',
          fees: 0.50,
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
          price: 150,
          fees: 1,
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Try to sell 150 shares (would cross zero)
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 150, // More than we own
          price: 160,
          fees: 1,
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
          price: 2.00,
          strike: 160,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T10:00:00Z'
        }),
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: 1.00,
          strike: 165,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T10:01:00Z'
        }),
        // Sell put spread (lower strike)
        createTestTransaction({
          id: 'txn-3',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-1',
          side: 'SELL',
          qty: 1,
          price: 1.50,
          strike: 150,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T10:02:00Z'
        }),
        createTestTransaction({
          id: 'txn-4',
          instrument_kind: 'PUT',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: 0.50,
          strike: 145,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T10:03:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.episodes).toHaveLength(2); // 2 episodes (call spread and put spread are closed)
      
      const callEpisodes = result.episodes.filter(e => e.kindGroup === 'OPTION' && e.currentRight === 'CALL');
      const putEpisodes = result.episodes.filter(e => e.kindGroup === 'OPTION' && e.currentRight === 'PUT');
      
      expect(callEpisodes).toHaveLength(1);
      expect(putEpisodes).toHaveLength(1);
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
          price: 3.00,
          strike: 160,
          expiry: '2025-09-19',
          fees: 0.50,
          timestamp: '2025-09-01T10:00:00Z'
        }),
        // Buy longer-term call
        createTestTransaction({
          id: 'txn-2',
          instrument_kind: 'CALL',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 1,
          price: 2.00,
          strike: 160,
          expiry: '2025-10-17', // Different expiry
          fees: 0.50,
          timestamp: '2025-09-01T10:01:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.episodes).toHaveLength(1); // Calendar spread is closed (opposite sides)
      
      const episode = result.episodes[0];
      expect(episode.qty).toBe(0); // Closed position
      expect(episode.currentExpiry).toBe('2025-10-17'); // Last transaction's expiry
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
      expect(result.balances.get('account-1')).toBe(1000);
      expect(result.balances.get('account-2')).toBe(3000); // 1000 (opening) + 2000 (transaction)
    });

    it('should handle zero quantity transactions', () => {
      const transactions = [
        createTestTransaction({
          id: 'txn-1',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker-1',
          side: 'BUY',
          qty: 0, // Zero quantity
          price: 150,
          fees: 1,
          timestamp: '2025-09-01T10:00:00Z'
        })
      ];

      const result = buildPortfolioView(transactions, tickerLookup, openingBalances);

      expect(result.ledger).toHaveLength(1);
      expect(result.ledger[0].accepted).toBe(true);
      expect(result.episodes).toHaveLength(1); // Zero quantity still creates an episode
    });
  });
});
