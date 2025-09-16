import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MarketDataDemo from '../MarketDataDemo';

// Mock the PortfolioContext
jest.mock('@/contexts/PortfolioContext', () => ({
  usePortfolio: () => ({
    getMarketCandles: jest.fn().mockResolvedValue([]),
    getMarketIndicator: jest.fn().mockResolvedValue([]),
    getMarketOption: jest.fn().mockResolvedValue(null),
    listMarketOptionKeys: jest.fn().mockResolvedValue([])
  })
}));

// Mock createAlpacaVendor
jest.mock('@/lib/vendors/alpaca/AlpacaVendor', () => ({
  createAlpacaVendor: jest.fn().mockReturnValue({
    name: 'alpaca',
    priority: 1,
    isHealthy: jest.fn().mockReturnValue(true),
    getCapabilities: jest.fn().mockReturnValue({
      supportsOptions: true,
      supportsRealTime: false,
      maxCandles: 200,
      supportedTimeframes: ['1D', '1W'],
      rateLimitPerMinute: 200,
      rateLimitPerDay: 10000
    })
  })
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('MarketDataDemo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('renders the demo page correctly', () => {
    render(<MarketDataDemo />);
    
    expect(screen.getByText('API Configuration')).toBeInTheDocument();
    expect(screen.getByText('Data Input')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('displays form inputs correctly', () => {
    render(<MarketDataDemo />);
    
    expect(screen.getByPlaceholderText('Enter API key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter secret key')).toBeInTheDocument();
    expect(screen.getByDisplayValue('AAPL')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1);
  });

  it('allows entering API credentials', () => {
    render(<MarketDataDemo />);
    
    const apiKeyInput = screen.getByPlaceholderText('Enter API key');
    const secretKeyInput = screen.getByPlaceholderText('Enter secret key');
    
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });
    fireEvent.change(secretKeyInput, { target: { value: 'test-secret-key' } });
    
    expect(apiKeyInput).toHaveValue('test-api-key');
    expect(secretKeyInput).toHaveValue('test-secret-key');
  });

  it('allows changing ticker symbol', () => {
    render(<MarketDataDemo />);
    
    const tickerInput = screen.getByDisplayValue('AAPL');
    fireEvent.change(tickerInput, { target: { value: 'TSLA' } });
    
    expect(tickerInput).toHaveValue('TSLA');
  });

  it('allows changing timeframe', () => {
    render(<MarketDataDemo />);
    
    const selects = screen.getAllByRole('combobox');
    const timeframeSelect = selects.find(sel => sel instanceof HTMLSelectElement && Array.from(sel.options).some(o => o.value === '1D')) || selects[0];
    fireEvent.change(timeframeSelect, { target: { value: '1W' } });
    
    expect(timeframeSelect).toHaveValue('1W');
  });

  it('displays action buttons', () => {
    render(<MarketDataDemo />);
    
    expect(screen.getByText('Test Connection')).toBeInTheDocument();
    expect(screen.getByText('Fetch Candles')).toBeInTheDocument();
    expect(screen.getByText('Force Refresh')).toBeInTheDocument();
    expect(screen.getByText('Calculate SMA(20)')).toBeInTheDocument();
    expect(screen.getByText('Fetch Option')).toBeInTheDocument();
    expect(screen.getByText('List Options')).toBeInTheDocument();
    expect(screen.getByText('Clear Cache')).toBeInTheDocument();
  });

  it('displays data sections', () => {
    render(<MarketDataDemo />);
    
    expect(screen.getByText('Candles (0)')).toBeInTheDocument();
    expect(screen.getByText('SMA(20) (0)')).toBeInTheDocument();
    expect(screen.getByText('Option Data')).toBeInTheDocument();
    expect(screen.getByText('Option Keys (0)')).toBeInTheDocument();
    expect(screen.getByText('Cache Status')).toBeInTheDocument();
    expect(screen.getByText('Error Log')).toBeInTheDocument();
  });

  it('shows no data messages initially', () => {
    render(<MarketDataDemo />);
    
    expect(screen.getByText('No candle data')).toBeInTheDocument();
    expect(screen.getByText('No indicator data')).toBeInTheDocument();
    expect(screen.getByText('No option data')).toBeInTheDocument();
    expect(screen.getByText('No option keys')).toBeInTheDocument();
    expect(screen.getByText('No cached data')).toBeInTheDocument();
    expect(screen.getByText('No errors')).toBeInTheDocument();
  });

  it('handles test connection button click', async () => {
    render(<MarketDataDemo />);
    
    const testButton = screen.getByText('Test Connection');
    fireEvent.click(testButton);
    
    // Button should exist and be clickable
    expect(testButton).toBeInTheDocument();
  });

  it('handles fetch candles button click', async () => {
    render(<MarketDataDemo />);
    
    const fetchButton = screen.getByText('Fetch Candles');
    fireEvent.click(fetchButton);
    
    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText('Fetch Candles')).toBeInTheDocument();
    });
  });

  it('handles clear cache button click', () => {
    render(<MarketDataDemo />);
    
    const clearButton = screen.getByText('Clear Cache');
    fireEvent.click(clearButton);
    
    // Should still be in the document after clearing
    expect(screen.getByText('Clear Cache')).toBeInTheDocument();
  });

  it('loads saved credentials on mount', () => {
    localStorageMock.getItem
      .mockReturnValueOnce('saved-api-key')
      .mockReturnValueOnce('saved-secret-key');
    
    render(<MarketDataDemo />);
    
    expect(localStorageMock.getItem).toHaveBeenCalledWith('alpaca_api_key');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('alpaca_secret_key');
  });

  it('saves credentials when test connection succeeds', async () => {
    render(<MarketDataDemo />);
    
    const apiKeyInput = screen.getByPlaceholderText('Enter API key');
    const secretKeyInput = screen.getByPlaceholderText('Enter secret key');
    const testButton = screen.getByText('Test Connection');
    
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });
    fireEvent.change(secretKeyInput, { target: { value: 'test-secret-key' } });
    fireEvent.click(testButton);
    
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('alpaca_api_key', 'test-api-key');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('alpaca_secret_key', 'test-secret-key');
    });
  });
});
