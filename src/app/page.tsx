"use client";

import { useState } from "react";
import { TrendingUp, Settings as SettingsIcon, Calendar, List, Upload } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import LoginForm from "@/components/LoginForm";
import Settings from "@/components/Settings";
import SharesPage from "@/components/SharesPage";
import OverviewPage from "@/components/OverviewPage";
import ReportPage from "@/components/ReportPage";
import OptionsPage from "@/components/OptionsPage";
import PositionsPage from "@/components/PositionsPage";
import TransactionsPage from "@/components/TransactionsPage";
import DataPage from "@/components/DataPage";

import DebugSupabase from "@/components/DebugSupabase";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useTimeRange } from "@/contexts/TimeRangeContext";
import { ViewType } from "@/types/navigation";
import { CurrencyAmount, sumAmounts } from "@/lib/currency-amount";




export default function Home() {
  const { user, loading, error, signOut } = useAuth();
  const { profile, updateProfile } = useUserProfile();
  const { loading: portfolioLoading, error: portfolioError } = usePortfolio();
  const { selectedRange } = useTimeRange();
  
  const [currentView, setCurrentView] = useState<ViewType>('overview');



  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  // Test function to trigger currency mismatch errors (development only)
  const testCurrencyErrors = () => {
    if (process.env.NODE_ENV !== 'development') return;
    
    console.log('🧪 Testing currency mismatch errors...');
    
    try {
      // This will trigger a currency mismatch error
      const usdAmount = new CurrencyAmount(100, 'USD');
      const audAmount = new CurrencyAmount(100, 'AUD');
      const result = usdAmount.add(audAmount); // This should throw an error
      console.log('Unexpected success:', result);
    } catch (error) {
      console.log('Expected error caught:', error);
    }
    
    try {
      // This will also trigger a currency mismatch error
      const amounts = [
        new CurrencyAmount(100, 'USD'),
        new CurrencyAmount(200, 'EUR')
      ];
      const sum = sumAmounts(amounts); // This should throw an error
      console.log('Unexpected success:', sum);
    } catch (error) {
      console.log('Expected error caught:', error);
    }
  };

  // Get the current view's header info
  const getViewHeader = () => {
    switch (currentView) {
      case 'settings':
        return {
          title: "Settings",
          icon: SettingsIcon,
          description: "Manage your account and preferences."
        };
      case 'shares':
        return {
          title: "Share Positions",
          icon: TrendingUp,
          description: "Current holdings grouped by ticker"
        };
      case 'transactions':
        return {
          title: "Positions",
          icon: List,
          description: "View your trading positions grouped by episodes and strategies."
        };
      case 'transactions-debug':
        return {
          title: "Transactions Debug",
          icon: List,
          description: "Debug view of all transactions for development purposes."
        };
      case 'weekly-report':
        return {
          title: "Report",
          icon: Calendar,
          description: "Performance and analytics for the selected time period."
        };
      case 'data':
        return {
          title: "Data Management",
          icon: Upload,
          description: "Import and export your trading data."
        };
      case 'overview':
      default:
        return {
          title: "Trading Tracker",
          icon: TrendingUp,
          description: "Track your trades and portfolio performance"
        };
    }
  };

  const currentHeader = getViewHeader();

  // Show error state
  if (error || portfolioError) {
    const isDatabaseError = portfolioError?.includes('Database not initialized');
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-xl mb-4">Error</div>
          <div className="text-white mb-4">{error || portfolioError}</div>
          {isDatabaseError ? (
            <div className="text-[#b3b3b3] text-sm space-y-2">
              <p>To fix this issue:</p>
              <ol className="text-left list-decimal list-inside space-y-1">
                <li>Run the database schema: <code className="bg-gray-800 px-2 py-1 rounded">clean-database-schema.sql</code></li>
                <li>Insert sample data: <code className="bg-gray-800 px-2 py-1 rounded">insert-sample-data.sql</code></li>
                <li>Refresh the page</li>
              </ol>
              <div className="mt-4">
                <DebugSupabase />
              </div>
            </div>
          ) : (
            <div className="text-[#b3b3b3] text-sm">
              Please check your configuration and restart the app.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading || portfolioLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return <LoginForm />;
  }

  // Render the appropriate view content
  const renderViewContent = () => {
    if (!selectedRange) {
      return <div className="text-center text-[#b3b3b3] py-8">Loading time range...</div>;
    }

    switch (currentView) {
      case 'settings':
        return <Settings updateProfile={updateProfile} profile={profile} />;
      case 'shares':
        return <SharesPage selectedRange={selectedRange} />;
      case 'options':
        return <OptionsPage selectedRange={selectedRange} />;
      case 'transactions':
        return <PositionsPage selectedRange={selectedRange} />;
      case 'transactions-debug':
        return <TransactionsPage selectedRange={selectedRange} />;
      case 'weekly-report':
        return <ReportPage selectedRange={selectedRange} />;
      case 'data':
        return <DataPage selectedRange={selectedRange} />;
      case 'overview':
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div data-1p-ignore data-lpignore="true" data-form-type="other">
      <Sidebar 
        onViewChange={handleViewChange} 
        currentView={currentView} 
        onLogout={signOut} 
        userProfile={profile}
      >
        <div className="min-h-screen bg-[#0f0f0f]">
          {/* Global Header */}
          <header className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-start mb-6">
                <div className="flex space-x-3">
                  <currentHeader.icon className="w-8 h-8 text-blue-400 flex-shrink-0 self-start" />
                  <div>
                    <h1 className="text-3xl font-bold text-white leading-none">{currentHeader.title}</h1>
                    <p className="text-[#b3b3b3] text-sm mt-1">{currentHeader.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {renderViewContent()}
            
            {/* Development-only currency error test button */}
            {process.env.NODE_ENV === 'development' && (
              <div className="fixed bottom-4 right-4 z-50">
                <button
                  onClick={testCurrencyErrors}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-mono shadow-lg"
                  title="Test currency mismatch errors (development only)"
                >
                  🧪 Test Currency Errors
                </button>
              </div>
            )}
          </main>
        </div>
      </Sidebar>
    </div>
  );
}