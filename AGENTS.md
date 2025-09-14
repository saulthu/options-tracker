# Options Tracker - AI Agent Guidelines

## 🎯 Project Overview

This is a **Next.js 15** options trading tracker application that helps users manage their covered calls, cash-secured puts, and share positions. The app provides comprehensive portfolio tracking with real-time data integration via Supabase.

## 🏗️ Architecture Principles

### **Component Structure**
- **Dedicated Components**: Every page is a self-contained component (e.g., `SharesPage.tsx`, `OptionsPage.tsx`, `TransactionsPage.tsx`)
- **Pure Router**: `src/app/page.tsx` acts as a pure router/layout - no embedded page content
- **Global State**: Time range selection is managed globally and shared across all pages
- **Consistent Props**: All page components receive `selectedRange: TimeRange` for date filtering

### **File Organization**
```
src/
├── app/page.tsx              # Main router/layout (NO page content)
├── components/
│   ├── [PageName]Page.tsx    # Dedicated page components
│   ├── ui/                   # Reusable UI components
│   └── TimeRangeSelector.tsx # Global time navigation
├── types/
│   ├── navigation.ts         # Shared type definitions
│   └── database.ts          # Database entity types
└── lib/                     # Utilities and configurations
```

## 🎨 UI/UX Standards

### **Design System**
- **Theme**: Dark theme with `bg-[#0f0f0f]` background
- **Cards**: `bg-[#1a1a1a]` with `border-[#2d2d2d]` borders
- **Text**: White primary, `text-[#b3b3b3]` secondary
- **Accents**: Blue (`text-blue-400`), Green (`text-green-400`), Red (`text-red-400`)

### **Button Standards**
- **ThemeButton**: Primary actions with icons
- **CancelButton**: Secondary/cancel actions
- **DestructiveButton**: Delete/destructive actions
- **Consistent Styling**: All buttons use the theme system, never native HTML buttons

### **Layout Consistency**
- **Padding**: All pages use `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- **Spacing**: Consistent `space-y-8` between sections
- **Grid**: Responsive grids with `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

## 🗄️ Database & Data Handling

### **Documentation Sync Rules** ⚠️ **CRITICAL**

#### **Database Implementation Sync**
- **ALWAYS keep database implementation in sync** with the episode-based portfolio calculation system
- **Before making ANY database changes**, ensure they align with the episode-based architecture
- **The episode-portfolio-calculator-v2.ts is the single source of truth** for all business logic
- **Any schema changes must be reflected** in both the SQL files AND the TypeScript interfaces
- **TypeScript interfaces must match** the episode-based data structures exactly
- **Business logic must implement** the rules defined in the episode-based system

#### **AGENTS.md Self-Maintenance** ⚠️ **CRITICAL**
- **ALWAYS keep `AGENTS.md` up-to-date** with any important architectural or process changes
- **Before making significant changes** to patterns, standards, or workflows, update AGENTS.md first
- **This file is the single source of truth** for how AI agents should behave in this codebase
- **Any new patterns, conventions, or rules** must be documented here immediately
- **When adding new components or features**, update the relevant sections in AGENTS.md
- **If you discover new pitfalls or best practices**, add them to the appropriate sections
- **Keep the "Recent Patterns" section current** with actual code examples from the project

### **Supabase Integration**
- **Authentication**: User management via Supabase Auth
- **Database**: PostgreSQL with UUID primary keys
- **Real-time**: Live data fetching for portfolio positions

### **Date Handling**
- **Time Ranges**: All pages use `TimeRange` interface with proper time boundaries
- **Database Queries**: Use full ISO timestamps (preserve `00:00:00.000` to `23:59:59.999`)
- **Date Fields**: Use `opened` field for trade execution dates, not `created`
- **Week Definition**: Sunday to Saturday (displayed as "Ending 9/5" - shows Friday)

### **Data Consistency**
- **Type Safety**: All database entities have TypeScript interfaces
- **UUID Usage**: All IDs are UUIDs, never integers
- **Options Contracts**: 1 contract = 100 shares (multiply by 100 for values)

## 🔧 Development Workflow

### **Build Process**
- **Always kill running servers** before building (`npm run build`)
- **Build before commit** - ensure clean builds
- **Fix linting errors** immediately
- **Use Turbopack** for faster builds

### **Git Workflow**
- **No Auto-Commit**: Never automatically commit changes - always ask user first
- **Clean commits**: Build successfully before committing
- **Descriptive messages**: Clear commit descriptions
- **Terminal Issues**: PowerShell hanging is a known issue, use Ctrl+C when needed

### **Code Quality**
- **TypeScript**: Strict typing, no `any` types
- **ESLint**: Fix all warnings and errors
- **Component Props**: Always define proper interfaces
- **Error Handling**: Comprehensive error states and loading indicators

### **Git Workflow**
- **Clean commits**: Build successfully before committing
- **Descriptive messages**: Clear commit descriptions
- **Terminal Issues**: PowerShell hanging is a known issue, use Ctrl+C when needed

## 📊 Business Logic

### **Options Trading Concepts**
- **Covered Calls (CC)**: Selling calls against owned shares
- **Cash Secured Puts (CSP)**: Selling puts with cash collateral
- **Assignment**: When options are exercised against you
- **Called Away**: When covered calls are exercised

### **Portfolio Calculations**
- **Cost Basis**: Average price paid for shares
- **Coverage**: How many shares are covered by options
- **P&L**: Profit/loss calculations with proper cash flow
- **Value Field**: Negative for outflows, positive for inflows

### **Time Range Behavior**
- **Global State**: Time range persists across all page navigation
- **Scale Changes**: Jump to current period when changing scales
- **Display Format**: US date format (9/5) for weekly ranges
- **Boundaries**: Include full day ranges (00:00:00 to 23:59:59)

## 🚫 Common Pitfalls to Avoid

### **Database Queries**
- ❌ Don't strip time from ISO strings (loses day boundaries)
- ❌ Don't mix `opened` and `created` date fields
- ❌ Don't use integer IDs where UUIDs are expected

### **Component Architecture**
- ❌ Don't embed page content in `page.tsx`
- ❌ Don't create inconsistent page structures
- ❌ Don't use native HTML buttons (use theme system)

### **State Management**
- ❌ Don't create infinite loops with `useEffect`
- ❌ Don't forget to memoize callbacks with `useCallback`
- ❌ Don't lose time range state when navigating

### **Database Specification**
- ❌ **NEVER make database changes without updating the spec first**
- ❌ **NEVER implement features that contradict the specification**
- ❌ **NEVER leave the specification out of sync with implementation**

### **AGENTS.md Maintenance**
- ❌ **NEVER make architectural changes without updating AGENTS.md**
- ❌ **NEVER add new patterns without documenting them here**
- ❌ **NEVER leave outdated information in AGENTS.md**

## 🎯 Success Criteria

A well-implemented feature should:
1. **Follow the component architecture** (dedicated components, pure router)
2. **Use consistent styling** (theme system, proper spacing)
3. **Handle dates correctly** (full time boundaries, proper field usage)
4. **Build cleanly** (no TypeScript/ESLint errors)
5. **Integrate with global state** (time range, user context)
6. **Provide proper error handling** (loading states, error messages)
7. **Keep database specification in sync** (spec matches implementation)
8. **Update AGENTS.md if needed** (document new patterns, rules, or changes)
9. **Use shared state management** (PortfolioContext, no direct Supabase queries)
10. **Implement performance optimizations** (memoization, filtered data methods)

## 🚀 Current Architecture Status

### **✅ What's Working Excellently**
- **Shared Layout**: Perfect implementation with `AuthProvider` and `PortfolioContext`
- **In-Memory State**: All transactions fetched once, portfolio calculated in-memory
- **Time Range Filtering**: Centralized filtering with `getFilteredPortfolio()` and `getFilteredTransactions()`
- **Performance**: Memoized calculations, no unnecessary re-renders
- **Consistency**: All page components follow the same patterns
- **Type Safety**: Full TypeScript coverage with proper interfaces
- **Database Design**: Single source of truth with derived in-memory views

### **📊 Architecture Score: 9.5/10** ⭐
- ✅ **Shared Layout**: Perfect
- ✅ **In-Memory State**: Excellent
- ✅ **Business Logic**: Clean separation
- ✅ **Consistency**: All components standardized
- ✅ **Performance**: Optimized with memoization
- ✅ **Type Safety**: Full coverage
- ✅ **Error Handling**: Comprehensive
- ✅ **Database Design**: Transaction-based with derived views
- ✅ **Time Filtering**: Centralized and efficient
- ✅ **Code Quality**: Clean, maintainable, follows best practices

### **🎉 Recent Improvements Made**
1. **Fixed SharesPage**: Now uses `PortfolioContext` instead of direct Supabase queries
2. **Added Time Filtering**: Centralized filtering methods in `PortfolioContext`
3. **Performance Optimization**: Added memoization to all expensive calculations
4. **Standardized Patterns**: All page components now follow the same architecture
5. **React Hooks Compliance**: Fixed all hooks rule violations
6. **Type Safety**: Resolved all TypeScript errors
7. **Build Success**: Clean builds with no errors or warnings
8. **Enhanced TransactionsPage**: Account-grouped view with running balance calculations
9. **Business Logic Integration**: Proper cash delta and balance calculations per transaction
10. **UI/UX Improvements**: Color-coded indicators, proper formatting, and enhanced display

The application now follows **industry best practices** for React/Next.js applications with a clean, maintainable, and performant architecture.

## 📝 When to Update AGENTS.md

**Update this file whenever you:**
- Add new components or pages
- Change architectural patterns
- Discover new best practices or pitfalls
- Modify development workflows
- Add new business logic rules
- Change database schema or relationships
- Update UI/UX standards
- Add new dependencies or tools
- Discover new common issues or solutions

**Keep these sections current:**
- Component Structure patterns
- UI/UX Standards
- Database & Data Handling rules
- Common Pitfalls to Avoid
- Recent Patterns (with actual code examples)
- Success Criteria

## 🔄 Recent Patterns

### **Optimized Page Component Template** ⭐ **NEW**

**Purpose**: Standardized structure for all page components to ensure consistency and performance.

**Key Structure**:
- **Props Interface**: Define `selectedRange: TimeRange` and other required props
- **Context Usage**: Use `useAuth()` and `usePortfolio()` hooks for data access
- **Data Filtering**: Use `getFilteredPortfolio()` or `getFilteredTransactions()` based on needs
- **Memoization**: Wrap expensive calculations in `useMemo()` for performance
- **Error Handling**: Implement loading, error, and authentication states
- **Early Returns**: Handle edge cases before main render logic

**Performance Benefits**:
- Memoized calculations prevent unnecessary re-renders
- Centralized data access through context
- Consistent error handling patterns
- Clean separation of concerns

### **Performance Optimization Patterns** ⭐ **NEW**

**Purpose**: Ensure optimal performance through proper memoization and React best practices.

**Key Patterns**:
- **Memoize Expensive Calculations**: Use `useMemo()` for complex data processing that depends on specific dependencies
- **Memoize Filtered Data**: Cache filtered results to prevent unnecessary recalculations on every render
- **Memoize Helper Functions**: Cache utility functions that don't change between renders
- **Proper Hook Usage**: Never call hooks conditionally - always call them at the top level
- **Dependency Arrays**: Include all dependencies in `useMemo()` and `useCallback()` arrays

**Performance Benefits**:
- Prevents unnecessary re-calculations
- Reduces render cycles
- Improves user experience with faster interactions
- Maintains React's reconciliation efficiency

### **Shared State Management Pattern** ⭐ **NEW**

**Purpose**: Centralize data access and state management across all page components.

**Key Principles**:
- **Context-Based Access**: All page components use `usePortfolio()` hook for data access
- **No Direct Queries**: Never make direct Supabase queries in page components
- **Centralized Filtering**: Use `getFilteredPortfolio()` and `getFilteredTransactions()` methods
- **Consistent Loading States**: Handle loading and error states uniformly across components
- **Single Source of Truth**: All data flows through the PortfolioContext

**Benefits**:
- Prevents duplicate data fetching
- Ensures consistent data across all pages
- Simplifies component logic
- Improves performance through shared state
- Makes testing and debugging easier

### **Time Range Filtering Pattern** ⭐ **NEW**

**Purpose**: Provide efficient time-based filtering of portfolio data across all components.

**Key Features**:
- **Centralized Filtering**: `getFilteredPortfolio()` and `getFilteredTransactions()` methods in PortfolioContext
- **Automatic Processing**: Methods handle time range filtering and portfolio recalculation
- **Performance Optimization**: Results are memoized to prevent unnecessary recalculations
- **Consistent Behavior**: All components use the same filtering logic

**How It Works**:
1. Filter transactions by time range (startDate to endDate)
2. Recalculate portfolio state for filtered data
3. Return memoized results for performance
4. Update automatically when time range changes

### **Account-Grouped Transaction Display Pattern** ⭐ **NEW**

**Purpose**: Display transactions organized by account with running balance calculations for each transaction.

**Key Features**:
- **Account Grouping**: Group all transactions by account ID, creating separate cards for each account
- **Running Balance Calculation**: Calculate cumulative account balance after each transaction
- **Cash Delta Logic**: Determine cash flow impact based on transaction type:
  - CASH transactions: Direct cash amount (positive/negative)
  - BUY transactions: Negative cash flow (cost + fees)
  - SELL transactions: Positive cash flow (proceeds - fees)
- **Chronological Sorting**: Sort transactions by timestamp within each account
- **Performance Optimization**: Use `useMemo` to prevent unnecessary recalculations

**Business Logic**:
- Each account shows its current running balance
- Each transaction displays its cash delta and resulting balance
- Proper handling of different instrument types (CASH, SHARES, CALL, PUT)
- Fallback account data when account details are missing

### **Enhanced Transaction Display Pattern** ⭐ **NEW**

**Purpose**: Format and display transaction information in a user-friendly, consistent manner.

**Key Features**:
- **Instrument Display Logic**: Convert raw transaction data into readable format:
  - CASH: Display as "Cash"
  - SHARES: Display as "BUY/SELL TICKER"
  - OPTIONS: Display as "BUY/SELL TICKER CALL/PUT $STRIKE EXPIRY"
- **Currency Formatting**: Consistent USD formatting using `Intl.NumberFormat`
- **Date/Time Formatting**: User-friendly timestamp display
- **Visual Indicators**: Color-coded transaction types (green for buys, red for sells)
- **Memo Display**: Show transaction notes with proper HTML entity escaping

**UI Components**:
- Account cards with institution and type information
- Transaction rows with running balance display
- Summary statistics cards at the top
- Responsive design with proper spacing and typography

### **Database Query Pattern**

**Purpose**: Standardized approach for querying Supabase database with proper error handling.

**Key Principles**:
- **Use PortfolioContext**: Never make direct database queries in page components
- **Centralized Queries**: All database access goes through PortfolioContext methods
- **Proper Error Handling**: Handle specific error codes and provide user-friendly messages
- **Time Range Filtering**: Use proper date boundaries for time-based queries
- **Type Safety**: Use TypeScript interfaces for all database entities

**Benefits**:
- Consistent error handling across the application
- Centralized data access patterns
- Better performance through shared state
- Easier testing and debugging

### **Error Handling Pattern**

**Purpose**: Provide comprehensive error handling for database operations and user interactions.

**Key Principles**:
- **Specific Error Handling**: Handle different error codes with appropriate user messages
- **Graceful Degradation**: Continue app functionality when possible, show helpful error messages
- **Comprehensive Logging**: Log detailed error information for debugging
- **User-Friendly Messages**: Convert technical errors into actionable user instructions
- **Type Safety**: Use proper TypeScript error typing for better error handling

**Common Error Scenarios**:
- Database not initialized (PGRST116)
- Permission denied (42501)
- Authentication issues
- Network connectivity problems
- Invalid data formats

**Best Practices**:
- Always provide fallback behavior
- Log errors with sufficient detail for debugging
- Show specific instructions for user actions
- Maintain app stability even with errors

### **Debugging Supabase Issues**
When encountering empty error objects or connection issues:
1. **Add comprehensive logging** to see exactly what's happening
2. **Test basic connectivity** with simple queries before complex ones
3. **Check environment variables** are properly loaded
4. **Use debug components** to isolate issues in the UI
5. **Handle graceful degradation** when database isn't initialized

### **Permission Error Fixes**
Common permission/RLS issues and their solutions:
1. **User not in users table**: Automatically create user record if missing
2. **RLS policy blocking access**: Ensure user can insert their own profile
3. **Permission denied errors**: Handle specific error codes (42501, insufficient_privilege)
4. **Authentication issues**: Verify user is properly authenticated before database queries
5. **Missing INSERT policy**: Add INSERT policy for users table to allow self-registration
6. **Graceful degradation**: Continue with main functionality even if user creation fails
7. **Comprehensive logging**: Log all error details to help diagnose permission issues

### **User Creation Architecture**
**CRITICAL**: User creation is handled by `useUserProfile` hook, NOT by PortfolioContext:
- **AuthContext**: Handles Supabase authentication
- **useUserProfile**: Handles user record creation in users table
- **PortfolioContext**: Only fetches transactions, does NOT create users
- **Avoid duplication**: Don't duplicate user creation logic across contexts

### **Authentication Error Fixes**
Common authentication issues and their solutions:
1. **AuthSessionMissingError**: PortfolioContext should use AuthContext instead of direct auth calls
2. **Race conditions**: Wait for auth to be ready before making database queries
3. **User not in users table**: Automatically create user record if missing
4. **RLS policy blocking access**: Ensure user can insert their own profile
5. **Permission denied errors**: Handle specific error codes (42501, insufficient_privilege)
6. **Authentication issues**: Verify user is properly authenticated before database queries
7. **Missing INSERT policy**: Add INSERT policy for users table to allow self-registration
8. **Graceful degradation**: Continue with main functionality even if user creation fails
9. **Comprehensive logging**: Log all error details to help diagnose permission issues
10. **Database not initialized**: User must run `clean-database-schema.sql` first
11. **Chicken-and-egg problem**: Don't query users table before user is created

### **Context Dependency Pattern** ⭐ **NEW**

**Purpose**: Ensure proper dependency management between contexts to avoid authentication race conditions.

**Problem**: PortfolioContext was making its own authentication calls instead of using AuthContext, causing "Auth session missing!" errors during app initialization.

**Solution**: 
1. **Use AuthContext**: PortfolioContext should depend on AuthContext for user state
2. **Wait for Auth**: Only fetch data when authentication is ready and user is available
3. **Proper Loading States**: Combine auth loading with data loading states
4. **Error Propagation**: Pass auth errors through to the UI

**Implementation**:
- **PortfolioContext**: Import and use `useAuth()` hook instead of direct Supabase auth calls
- **Dependency Management**: Wait for `!authLoading && user && !authError` before fetching data
- **Loading States**: Combine `loading || authLoading` for proper UI feedback
- **Error Handling**: Combine `error || authError` for comprehensive error reporting

**Benefits**:
- **No Race Conditions**: Data fetching waits for proper authentication
- **Cleaner Architecture**: Single source of truth for authentication state
- **Better Error Handling**: Auth errors properly propagated to UI
- **Consistent Loading**: Unified loading states across the app

### **TimeRange Context Pattern** ⭐ **NEW**

**Purpose**: Centralize time range selection state management in a shared context for consistent access across all components.

**Problem**: Time range state was managed in the main page component, but it's actually global UI state that affects all pages and should be managed at the layout level.

**Solution**: 
1. **Create TimeRangeContext** with `selectedRange`, `setSelectedRange`, and `handleRangeChange`
2. **Add TimeRangeProvider** to the root layout alongside AuthProvider and PortfolioProvider
3. **Move time range logic** from main page to the shared context
4. **Update components** to use `useTimeRange()` hook instead of prop drilling

**Implementation**:
- **TimeRangeContext**: Manages time range state and provides `useTimeRange()` hook
- **Root Layout**: Wraps app with TimeRangeProvider for global access
- **Sidebar**: Uses `useTimeRange()` directly instead of receiving props
- **Main Page**: Simplified to only handle view switching, time range handled by context

**Benefits**:
- **Consistent Architecture**: All global state managed in contexts
- **Cleaner Components**: No prop drilling for time range state
- **Better Separation**: UI state vs business logic state clearly separated
- **Easier Testing**: Time range logic isolated and testable
- **Future-Proofing**: Clear pattern for adding more global UI state

### **Account Data Synchronization Pattern** ⭐ **NEW**

**Purpose**: Ensure that when account information is updated in settings, the transaction data reflects the new account names and details.

**Problem**: Transactions are loaded with JOINed account data at startup. When account names are updated in settings, the in-memory transaction data still contains the old account names.

**Solution**: 
1. **Add refresh method** to PortfolioContext: `refreshOnAccountChange()`
2. **Call refresh** from settings page after account updates (create, update, delete)
3. **Re-fetch transactions** with fresh JOINed account data
4. **Recalculate portfolio** with updated account information

**Implementation**:
- **PortfolioContext**: Add `refreshOnAccountChange()` method that calls `fetchTransactions()`
- **Settings Page**: Call `refreshOnAccountChange()` after successful account operations
- **Automatic Sync**: Account changes immediately reflect in all transaction displays

**Benefits**:
- **Data Consistency**: Transaction displays always show current account names
- **User Experience**: Changes are immediately visible across the app
- **Minimal Overhead**: Only refreshes when accounts actually change
- **Clean Architecture**: Settings page triggers refresh, PortfolioContext handles the logic

### **Single Responsibility & No Redundancy Pattern** ⭐ **NEW**

**Purpose**: Ensure that each module has a single, well-defined responsibility and avoid duplicating logic across components.

**Key Principles**:
- **Single Source of Truth**: Each business logic calculation should exist in exactly one place
- **Module Responsibility**: Each module should have one clear purpose (e.g., episode-portfolio-calculator-v2.ts for all portfolio calculations)
- **No Duplication**: Never reimplement business logic that already exists in a specialized module
- **Use Existing APIs**: Always use existing methods from specialized modules instead of reimplementing
- **Centralized Logic**: Keep all related calculations in the same module for consistency

**Common Violations**:
- ❌ **Reimplementing calculations** in UI components that already exist in business logic modules
- ❌ **Duplicating data processing** across multiple components
- ❌ **Creating parallel state management** when centralized state already exists
- ❌ **Manual calculations** when automated calculations are available
- ❌ **Redundant data fetching** when data is already available in context

**Examples of Correct Usage**:
- ✅ **Portfolio Calculations**: Use `episode-portfolio-calculator-v2.ts` for all P&L, balances, positions
- ✅ **Data Access**: Use `PortfolioContext` methods instead of direct Supabase queries
- ✅ **Time Filtering**: Use `getFilteredPortfolio()` instead of manual date filtering
- ✅ **State Management**: Use context hooks instead of local state for shared data

**Redundancy Detection Checklist**:
1. **Before implementing any calculation**, check if it already exists in a specialized module
2. **Before creating new state**, check if it's already available in a context
3. **Before writing data processing**, check if there's an existing method that does it
4. **Before duplicating logic**, refactor to use the existing implementation
5. **Always prefer composition** over duplication

**Benefits**:
- **Consistency**: All calculations use the same logic
- **Maintainability**: Changes only need to be made in one place
- **Accuracy**: Reduces risk of calculation discrepancies
- **Performance**: Avoids redundant processing
- **Testing**: Easier to test centralized logic

### **Position Filtering Pattern** ⭐ **NEW**

**Purpose**: Provide flexible position filtering options that match different user mental models for viewing portfolio data.

**Problem**: Users need different views of their positions based on their analysis needs - some want to see all active positions during a period, others want to focus on new positions or completed trades.

**Solution**: 
1. **Multiple Filter Modes**: Implement three filtering semantics:
   - **Any Overlap**: Show positions active during the selected period (default)
   - **Opened During**: Show only positions opened within the period
   - **Closed During**: Show only positions closed within the period
2. **User-Selectable Interface**: Provide a filter selector component for easy switching
3. **Consistent Implementation**: Use the same filtering logic across all position views

**Implementation**:
- **Filter Types**: Define `PositionFilterType` enum with three options
- **Enhanced Function**: Update `filterEpisodesByDateRange()` to accept filter type parameter
- **UI Component**: Create `PositionFilterSelector` with compact design
- **Context Integration**: Update `PortfolioContext` methods to support filter types
- **Default Behavior**: Default to "Overlap Period" for intuitive user experience
- **Table Integration**: Position filter selector integrated into table header
- **Extensible Design**: Structured to accommodate future filters like "exclude open positions"

**Filter Logic**:
- **Any Overlap**: `openedBeforeOrDuring && (notClosed || closedAfter)`
- **Opened During**: `openTimestamp >= startDate && openTimestamp <= endDate`
- **Closed During**: `closeTimestamp >= startDate && closeTimestamp <= endDate`

**Benefits**:
- **User Flexibility**: Different views for different analysis needs
- **Intuitive Defaults**: "Any Overlap" matches user expectations
- **Consistent UX**: Same filtering options across all position views
- **Performance**: Efficient filtering with proper memoization
- **Maintainable**: Centralized filtering logic in business layer

### **Database Implementation Update Pattern**
1. **Update `src/lib/episode-portfolio-calculator-v2.ts`** with new business logic requirements
2. **Update `clean-database-schema.sql`** to match the episode-based system
3. **Update TypeScript interfaces** in `src/types/episodes.ts` and `src/types/database.ts`
4. **Update business logic** in `src/lib/episode-portfolio-calculator-v2.ts`
5. **Update sample data** in `insert-sample-data.sql`
6. **Test and build** to ensure everything works

### **User-Specific Data Pattern** ⭐ **NEW**

**Purpose**: Ensure all data is properly scoped to individual users for multi-tenant security and data isolation.

**Problem**: Some database tables (like tickers) were shared across all users, which could lead to data leakage and security issues in a multi-tenant application.

**Solution**: 
1. **Add user_id to all tables** that should be user-specific
2. **Update RLS policies** to enforce user-based access control
3. **Update TypeScript interfaces** to include user_id fields
4. **Update sample data** to include user_id references
5. **Update unit tests** to handle user_id in test data

**Implementation**:
- **Database Schema**: Add `user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE` to user-specific tables
- **RLS Policies**: Change from public access to user-specific access (e.g., `auth.uid() = user_id`)
- **TypeScript Interfaces**: Add `user_id: string` to relevant interfaces
- **Sample Data**: Use `(SELECT id FROM public.users LIMIT 1)` for user_id references
- **Unit Tests**: Include user_id in test data structures

**Benefits**:
- **Security**: Proper data isolation between users
- **Multi-tenancy**: Support for multiple users without data conflicts
- **Data Integrity**: Foreign key constraints ensure data consistency
- **Scalability**: Each user's data is independently manageable

**Example**: Adding user_id to tickers table:
```sql
-- Before: Shared tickers
CREATE TABLE public.tickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  icon TEXT
);

-- After: User-specific tickers
CREATE TABLE public.tickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  UNIQUE(user_id, name)
);
```

Remember: This is a **trading application** - accuracy in calculations, proper date handling, and consistent data presentation are critical for user trust and financial accuracy. **The episode-based portfolio calculator is the foundation of all data integrity.**
