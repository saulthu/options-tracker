# Simplified Market Data Demo Plan

**Goal:** Create a simple, working demo page that showcases the core market data caching system with Alpaca vendor support.

---

## Core Features (Simplified but Extensible)

### 1. Extensible Vendor Interface
- Simple `MarketDataVendor` interface with essential methods
- Alpaca vendor implementation only (initially)
- **Extensibility**: Interface designed to support future vendors without changes
- **Future-ready**: Vendor factory pattern ready for easy addition of new vendors

### 2. Flexible MarketData Class
- Extend existing `MarketData` class to accept vendor injection
- Keep existing caching and persistence logic
- **Extensibility**: Support for multiple vendors (primary/fallback) from day one
- **Future-ready**: Configuration system ready for advanced features

### 3. Demo Page (Single Component)
- API credentials input (Alpaca only initially)
- Ticker input and data fetch
- Basic data display (candles, options, indicators)
- Simple error display
- Cache status display
- **Extensibility**: Component structure ready for advanced features

### 4. Essential Testing
- Unit tests for vendor interface
- Integration tests for Alpaca vendor
- Basic demo page tests
- **Extensibility**: Test framework ready for additional vendors

---

## Implementation Tasks (Simplified)

### Task 1: Create Extensible Vendor Interface
**Files:**
- `src/lib/vendors/base/MarketDataVendor.ts` - Extensible interface
- `src/lib/vendors/alpaca/AlpacaVendor.ts` - Alpaca implementation
- `src/lib/vendors/VendorFactory.ts` - Simple factory for future vendors

**Interface (Extensible):**
```typescript
interface MarketDataVendor {
  name: string;
  priority: number; // For vendor selection
  fetchCandles(ticker: string, timeframe: '1D' | '1W'): Promise<Candle[]>;
  fetchOption(ticker: string, key: OptionKey): Promise<OptionsEntry>;
  getCurrentPrice(ticker: string): Promise<number>;
  isHealthy(): boolean;
  // Future extensibility hooks
  getCapabilities?(): VendorCapabilities;
  getRateLimit?(): RateLimitInfo;
}

interface VendorCapabilities {
  supportsOptions: boolean;
  supportsRealTime: boolean;
  maxCandles: number;
}

interface RateLimitInfo {
  requestsPerMinute: number;
  requestsPerDay: number;
}
```

### Task 2: Update MarketData Class
**Files:**
- Modify `src/lib/market-data.ts` to accept vendor injection

**Changes:**
- Add constructor parameter for vendors array
- Add vendor selection logic (priority-based)
- Add fallback vendor support
- Keep existing caching logic
- **Extensibility**: Ready for vendor-specific configurations

### Task 3: Create Demo Page
**Files:**
- `src/components/MarketDataDemo.tsx` - Single component with all sections
- Update `src/components/Sidebar.tsx` - Add demo page link

**Sections:**
- API credentials form (Alpaca only initially)
- Ticker input and fetch button
- Data display (simple tables/charts)
- Error log
- Cache status
- **Extensibility**: Component structure ready for multiple vendors

### Task 4: Add Basic Testing
**Files:**
- `src/lib/__tests__/alpaca-vendor.test.ts`
- `src/lib/__tests__/market-data-demo.test.ts`

---

## Removed Complexity (But Kept Extensibility)

### ❌ Removed Features (Initially)
- Complex vendor registry system
- Multiple vendor support (Polygon, IEX, etc.) - **But interface ready for them**
- Advanced vendor factory - **But simple factory included**
- Complex settings management - **But configuration system ready**
- Database schema changes
- Advanced error handling - **But error handling hooks ready**
- Performance monitoring - **But monitoring hooks ready**
- Rate limiting visualization - **But rate limit info available**
- Complex UI components - **But component structure extensible**

### ✅ Kept Core Features + Extensibility
- Market data caching (memory + DB)
- Alpaca vendor integration
- Basic error handling
- Simple demo page
- Essential testing
- **Extensibility hooks for future features**

---

## Success Criteria (Simplified but Extensible)

**Demo is complete when:**
- [ ] User can enter Alpaca API credentials
- [ ] User can fetch candles for a ticker
- [ ] Data is cached and displayed
- [ ] Basic errors are shown
- [ ] Cache status is visible
- [ ] Tests pass
- [ ] **System is ready for additional vendors** (interface supports it)
- [ ] **System is ready for advanced features** (hooks in place)

**Performance Targets:**
- [ ] Page loads in <2 seconds
- [ ] Data fetch completes in <5 seconds
- [ ] Basic functionality works reliably

**Extensibility Targets:**
- [ ] Adding new vendor requires only implementing interface
- [ ] Adding advanced features requires minimal refactoring
- [ ] Configuration system ready for complex settings

---

## Implementation Timeline

**Week 1: Core Implementation**
- Day 1-2: Vendor interface and Alpaca implementation
- Day 3-4: MarketData class updates
- Day 5: Demo page creation

**Week 2: Testing and Polish**
- Day 1-2: Basic testing
- Day 3-4: Bug fixes and improvements
- Day 5: Documentation

This simplified plan focuses on getting a working demo quickly without over-engineering the solution.
