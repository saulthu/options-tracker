import { buildPortfolioView } from '../portfolio-calculator';
import { CurrencyAmount } from '../currency-amount';
import { RawTransaction } from '../../types/episodes';

describe('Forex Currency Handling', () => {
  const tickerLookup = new Map<string, string>();

  describe('Forex transactions are treated as individual cash episodes', () => {
    it('should create separate cash episodes for forex transactions', () => {
      const transactions: RawTransaction[] = [
        {
          id: '1',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'SELL',
          qty: -100,
          price: new CurrencyAmount(1.0, 'AUD'),
          fees: new CurrencyAmount(0.0, 'AUD'),
          currency: 'AUD',
          memo: 'Forex: Sell 100 AUD to buy 64.2 USD'
        },
        {
          id: '2',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:01Z',
          created_at: '2024-01-01T00:00:01Z',
          updated_at: '2024-01-01T00:00:01Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'BUY',
          qty: 64.2,
          price: new CurrencyAmount(1.0, 'USD'),
          fees: new CurrencyAmount(0.0, 'USD'),
          currency: 'USD',
          memo: 'Forex: Buy 64.2 USD with 100 AUD'
        }
      ];

      const result = buildPortfolioView(transactions, tickerLookup);

      // Should create 2 separate cash episodes (not grouped)
      expect(result.episodes).toHaveLength(2);
      
      // Both should be CASH kindGroup
      expect(result.episodes[0].kindGroup).toBe('CASH');
      expect(result.episodes[1].kindGroup).toBe('CASH');
      
      // Both should have correct individual amounts
      expect(result.episodes[0].cashTotal.amount).toBe(-100);
      expect(result.episodes[0].cashTotal.currency).toBe('AUD');
      expect(result.episodes[1].cashTotal.amount).toBe(64.2);
      expect(result.episodes[1].cashTotal.currency).toBe('USD');
    });

    it('should preserve correct account balances for forex transactions', () => {
      const transactions: RawTransaction[] = [
        {
          id: '1',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'SELL',
          qty: -100,
          price: new CurrencyAmount(1.0, 'AUD'),
          fees: new CurrencyAmount(0.0, 'AUD'),
          currency: 'AUD',
          memo: 'Forex: Sell 100 AUD to buy 64.2 USD'
        },
        {
          id: '2',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:01Z',
          created_at: '2024-01-01T00:00:01Z',
          updated_at: '2024-01-01T00:00:01Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'BUY',
          qty: 64.2,
          price: new CurrencyAmount(1.0, 'USD'),
          fees: new CurrencyAmount(0.0, 'USD'),
          currency: 'USD',
          memo: 'Forex: Buy 64.2 USD with 100 AUD'
        }
      ];

      const result = buildPortfolioView(transactions, tickerLookup);

      // Check account balances
      const accountBalances = result.balances.get('account1');
      expect(accountBalances).toBeDefined();
      
      const audBalance = accountBalances!.get('AUD');
      const usdBalance = accountBalances!.get('USD');
      
      expect(audBalance).toBeDefined();
      expect(usdBalance).toBeDefined();
      
      expect(audBalance!.amount).toBe(-100);
      expect(usdBalance!.amount).toBe(64.2);
    });

    it('should handle multiple forex transactions correctly', () => {
      const transactions: RawTransaction[] = [
        // First forex trade: 100 AUD -> 64.2 USD
        {
          id: '1',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'SELL',
          qty: -100,
          price: new CurrencyAmount(1.0, 'AUD'),
          fees: new CurrencyAmount(0.0, 'AUD'),
          currency: 'AUD',
          memo: 'Forex: Sell 100 AUD to buy 64.2 USD'
        },
        {
          id: '2',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:01Z',
          created_at: '2024-01-01T00:00:01Z',
          updated_at: '2024-01-01T00:00:01Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'BUY',
          qty: 64.2,
          price: new CurrencyAmount(1.0, 'USD'),
          fees: new CurrencyAmount(0.0, 'USD'),
          currency: 'USD',
          memo: 'Forex: Buy 64.2 USD with 100 AUD'
        },
        // Second forex trade: 50 AUD -> 32.1 USD
        {
          id: '3',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-02T00:00:00Z',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'SELL',
          qty: -50,
          price: new CurrencyAmount(1.0, 'AUD'),
          fees: new CurrencyAmount(0.0, 'AUD'),
          currency: 'AUD',
          memo: 'Forex: Sell 50 AUD to buy 32.1 USD'
        },
        {
          id: '4',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-02T00:00:01Z',
          created_at: '2024-01-02T00:00:01Z',
          updated_at: '2024-01-02T00:00:01Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'BUY',
          qty: 32.1,
          price: new CurrencyAmount(1.0, 'USD'),
          fees: new CurrencyAmount(0.0, 'USD'),
          currency: 'USD',
          memo: 'Forex: Buy 32.1 USD with 50 AUD'
        }
      ];

      const result = buildPortfolioView(transactions, tickerLookup);

      // Should create 4 separate cash episodes
      expect(result.episodes).toHaveLength(4);
      
      // All should be CASH kindGroup
      result.episodes.forEach(episode => {
        expect(episode.kindGroup).toBe('CASH');
      });

      // Check final account balances
      const accountBalances = result.balances.get('account1');
      expect(accountBalances).toBeDefined();
      
      const audBalance = accountBalances!.get('AUD');
      const usdBalance = accountBalances!.get('USD');
      
      expect(audBalance!.amount).toBe(-150); // -100 + -50
      expect(usdBalance!.amount).toBe(96.3); // 64.2 + 32.1
    });

    it('should not group forex transactions with regular cash transactions', () => {
      const transactions: RawTransaction[] = [
        // Regular cash deposit
        {
          id: '1',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'BUY',
          qty: 1000,
          price: new CurrencyAmount(1.0, 'USD'),
          fees: new CurrencyAmount(0.0, 'USD'),
          currency: 'USD',
          memo: 'Initial deposit'
        },
        // Forex transaction
        {
          id: '2',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:01Z',
          created_at: '2024-01-01T00:00:01Z',
          updated_at: '2024-01-01T00:00:01Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'SELL',
          qty: -100,
          price: new CurrencyAmount(1.0, 'AUD'),
          fees: new CurrencyAmount(0.0, 'AUD'),
          currency: 'AUD',
          memo: 'Forex: Sell 100 AUD to buy 64.2 USD'
        },
        {
          id: '3',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:02Z',
          created_at: '2024-01-01T00:00:02Z',
          updated_at: '2024-01-01T00:00:02Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'BUY',
          qty: 64.2,
          price: new CurrencyAmount(1.0, 'USD'),
          fees: new CurrencyAmount(0.0, 'USD'),
          currency: 'USD',
          memo: 'Forex: Buy 64.2 USD with 100 AUD'
        }
      ];

      const result = buildPortfolioView(transactions, tickerLookup);

      // Should create 3 separate cash episodes
      expect(result.episodes).toHaveLength(3);
      
      // All should be CASH kindGroup
      result.episodes.forEach(episode => {
        expect(episode.kindGroup).toBe('CASH');
      });

      // Check that we have the expected amounts (not necessarily in order)
      const amounts = result.episodes.map(ep => ep.cashTotal.amount);
      expect(amounts).toContain(-100);
      expect(amounts).toContain(64.2);
      expect(amounts).toContain(1000);
      expect(amounts).toHaveLength(3);
    });
  });

  describe('Currency separation in portfolio processing', () => {
    it('should process forex transactions separately from regular transactions', () => {
      const transactions: RawTransaction[] = [
        // Regular USD transaction
        {
          id: '1',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          instrument_kind: 'SHARES',
          ticker_id: 'ticker1',
          expiry: undefined,
          strike: undefined,
          side: 'BUY',
          qty: 100,
          price: new CurrencyAmount(50.0, 'USD'),
          fees: new CurrencyAmount(1.0, 'USD'),
          currency: 'USD',
          memo: 'Buy AAPL shares'
        },
        // Forex transaction
        {
          id: '2',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:01Z',
          created_at: '2024-01-01T00:00:01Z',
          updated_at: '2024-01-01T00:00:01Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'SELL',
          qty: -100,
          price: new CurrencyAmount(1.0, 'AUD'),
          fees: new CurrencyAmount(0.0, 'AUD'),
          currency: 'AUD',
          memo: 'Forex: Sell 100 AUD to buy 64.2 USD'
        },
        {
          id: '3',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:02Z',
          created_at: '2024-01-01T00:00:02Z',
          updated_at: '2024-01-01T00:00:02Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'BUY',
          qty: 64.2,
          price: new CurrencyAmount(1.0, 'USD'),
          fees: new CurrencyAmount(0.0, 'USD'),
          currency: 'USD',
          memo: 'Forex: Buy 64.2 USD with 100 AUD'
        }
      ];

      const tickerLookupWithData = new Map([['ticker1', 'AAPL']]);
      const result = buildPortfolioView(transactions, tickerLookupWithData);

      // Should have 1 SHARES episode and 2 CASH episodes
      expect(result.episodes).toHaveLength(3);
      
      const sharesEpisodes = result.episodes.filter(ep => ep.kindGroup === 'SHARES');
      const cashEpisodes = result.episodes.filter(ep => ep.kindGroup === 'CASH');
      
      expect(sharesEpisodes).toHaveLength(1);
      expect(cashEpisodes).toHaveLength(2);
      
      // Check that the shares episode has correct totals
      const sharesEpisode = sharesEpisodes[0];
      expect(sharesEpisode.cashTotal.amount).toBe(-5001); // -(100 * 50) - 1
      expect(sharesEpisode.cashTotal.currency).toBe('USD');
      
      // Check that forex cash episodes have correct individual amounts
      const forexAmounts = cashEpisodes.map(ep => ep.cashTotal.amount).sort();
      expect(forexAmounts).toEqual([-100, 64.2]);
    });
  });

  describe('Error handling', () => {
    it('should handle forex transactions with missing price', () => {
      const transactions: RawTransaction[] = [
        {
          id: '1',
          user_id: 'user1',
          account_id: 'account1',
          timestamp: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          instrument_kind: 'CASH',
          ticker_id: undefined,
          expiry: undefined,
          strike: undefined,
          side: 'SELL',
          qty: -100,
          price: undefined, // Missing price
          fees: new CurrencyAmount(0.0, 'AUD'),
          currency: 'AUD',
          memo: 'Forex: Sell 100 AUD to buy 64.2 USD'
        }
      ];

      expect(() => {
        buildPortfolioView(transactions, tickerLookup);
      }).toThrow('Price should be set to 1.0 for cash transactions');
    });
  });
});
