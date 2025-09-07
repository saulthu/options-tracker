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

#### **Database Specification Sync**
- **ALWAYS keep `src/docs/database_spec.md` in sync** with the actual database implementation
- **Before making ANY database changes**, update the specification first
- **The database_spec.md is the single source of truth** for all database design decisions
- **Any schema changes must be reflected** in both the SQL files AND the specification
- **TypeScript interfaces must match** the specification exactly
- **Business logic must implement** the rules defined in the specification

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
- **Week Definition**: Saturday to Friday (displayed as "Ending 9/5")

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
```typescript
interface [PageName]PageProps {
  selectedRange: TimeRange;
  // other props as needed
}

export default function [PageName]Page({ selectedRange }: [PageName]PageProps) {
  const { user } = useAuth();
  const { getFilteredPortfolio, getFilteredTransactions, loading, error } = usePortfolio();

  // Get filtered data for the selected time range
  const filteredData = useMemo(() => {
    return getFilteredPortfolio(selectedRange); // or getFilteredTransactions(selectedRange)
  }, [getFilteredPortfolio, selectedRange]);

  // Memoize expensive calculations
  const calculatedData = useMemo(() => {
    // Expensive calculations here
    return processData(filteredData);
  }, [filteredData]);

  // Early returns after all hooks
  if (loading) return <LoadingComponent />;
  if (error) return <ErrorComponent error={error} />;
  if (!user) return <LoginPrompt />;

  return (
    <div className="space-y-8">
      {/* Page content using calculatedData */}
    </div>
  );
}
```

### **Performance Optimization Patterns** ⭐ **NEW**
```typescript
// ✅ GOOD: Memoize expensive calculations
const summaryStats = useMemo(() => {
  return calculateExpensiveStats(data);
}, [data]);

// ✅ GOOD: Memoize filtered data
const filteredTransactions = useMemo(() => {
  return getFilteredTransactions(selectedRange);
}, [getFilteredTransactions, selectedRange]);

// ✅ GOOD: Memoize helper functions
const formatCurrency = useMemo(() => (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}, []);

// ❌ BAD: Don't call hooks conditionally
if (loading) return <div>Loading...</div>; // This breaks hooks rules
const data = useMemo(() => calculate(), []); // This won't work
```

### **Shared State Management Pattern** ⭐ **NEW**
```typescript
// All page components should use PortfolioContext
const { 
  getFilteredPortfolio,    // For position/balance data
  getFilteredTransactions, // For transaction lists
  loading, 
  error 
} = usePortfolio();

// Never fetch data directly in page components
// ❌ BAD: Direct Supabase queries in components
const { data } = await supabase.from('transactions').select('*');

// ✅ GOOD: Use context methods
const transactions = getFilteredTransactions(selectedRange);
```

### **Time Range Filtering Pattern** ⭐ **NEW**
```typescript
// PortfolioContext provides filtered data methods
const filteredPortfolio = getFilteredPortfolio(selectedRange);
const filteredTransactions = getFilteredTransactions(selectedRange);

// These methods automatically:
// 1. Filter by time range (startDate to endDate)
// 2. Recalculate portfolio state for filtered data
// 3. Return memoized results for performance
```

### **Database Query Pattern**
```typescript
const { data, error } = await supabase
  .from('transactions')
  .select('*')
  .gte('opened', selectedRange.startDate.toISOString())
  .lte('opened', selectedRange.endDate.toISOString());
```

### **Error Handling Pattern**
```typescript
try {
  const { data, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id);

  if (fetchError) {
    // Handle specific error cases
    if (fetchError.code === 'PGRST116' || fetchError.message?.includes('relation does not exist')) {
      setError('Database not initialized. Please run the database setup first.');
      return;
    }
    throw fetchError;
  }
  
  setData(data || []);
} catch (err) {
  console.error('Error details:', {
    name: (err as Error & { code?: string; details?: string; hint?: string })?.name,
    message: (err as Error & { code?: string; details?: string; hint?: string })?.message,
    code: (err as Error & { code?: string; details?: string; hint?: string })?.code,
  });
  setError(err instanceof Error ? err.message : 'Operation failed');
}
```

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

### **Permission Error Fixes**
Common permission/RLS issues and their solutions:
1. **User not in users table**: Automatically create user record if missing
2. **RLS policy blocking access**: Ensure user can insert their own profile
3. **Permission denied errors**: Handle specific error codes (42501, insufficient_privilege)
4. **Authentication issues**: Verify user is properly authenticated before database queries
5. **Missing INSERT policy**: Add INSERT policy for users table to allow self-registration
6. **Graceful degradation**: Continue with main functionality even if user creation fails
7. **Comprehensive logging**: Log all error details to help diagnose permission issues
8. **Database not initialized**: User must run `clean-database-schema.sql` first
9. **Chicken-and-egg problem**: Don't query users table before user is created

### **Database Specification Update Pattern**
1. **Update `src/docs/database_spec.md`** with new requirements
2. **Update `clean-database-schema.sql`** to match specification
3. **Update TypeScript interfaces** in `src/types/database.ts`
4. **Update business logic** in `src/lib/portfolio-calculator.ts`
5. **Update sample data** in `insert-sample-data.sql`
6. **Test and build** to ensure everything works

Remember: This is a **trading application** - accuracy in calculations, proper date handling, and consistent data presentation are critical for user trust and financial accuracy. **The database specification is the foundation of all data integrity.**
