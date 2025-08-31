"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Activity, Plus } from "lucide-react";
import NewTradeForm from "@/components/NewTradeForm";
import PnLChart from "@/components/PnLChart";
import Sidebar from "@/components/Sidebar";
import LoginForm from "@/components/LoginForm";
import Settings from "@/components/Settings";

import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";

interface Trade {
  id: string;
  user_id: string;
  account_id: string;
  type: 'Cash' | 'Shares' | 'CSP' | 'CC' | 'Call' | 'Put';
  action: 'Buy' | 'Sell' | 'Deposit' | 'Withdraw' | 'Adjustment';
  ticker_id?: string;
  price: number;
  quantity: number;
  value: number;
  strike?: number;
  expiry?: string;
  opened: string;
  closed?: string;
  close_method?: 'Manual' | 'Expired' | 'Assigned';
  created: string;
}

  type ViewType = 'overview' | 'weekly-report' | 'settings';

export default function Home() {
  const { user, loading, error, signOut } = useAuth();
  const { profile, hasProfile, loading: profileLoading } = useUserProfile();
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [trades, setTrades] = useState<Trade[]>([
    {
      id: "1",
      user_id: "user-1",
      account_id: "1",
      type: "Call",
      action: "Buy",
      ticker_id: "1",
      price: 5.50,
      quantity: 1,
      value: 550,
      strike: 150,
      expiry: "2024-01-19",
      opened: "2024-01-15",
      created: "2024-01-15T10:00:00Z"
    },
    {
      id: "2",
      user_id: "user-1",
      account_id: "1",
      type: "Put",
      action: "Buy",
      ticker_id: "2",
      price: 3.80,
      quantity: 2,
      value: 760,
      strike: 200,
      expiry: "2024-01-26",
      opened: "2024-01-16",
      created: "2024-01-16T10:00:00Z"
    },
    {
      id: "3",
      user_id: "user-1",
      account_id: "1",
      type: "Shares",
      action: "Buy",
      ticker_id: "3",
      price: 150.25,
      quantity: 10,
      value: 1502.50,
      opened: "2024-01-17",
      created: "2024-01-17T10:00:00Z"
    },
    {
      id: "4",
      user_id: "user-1",
      account_id: "1",
      type: "Cash",
      action: "Deposit",
      price: 1.0,
      quantity: 1,
      value: 5000,
      opened: "2024-01-10",
      created: "2024-01-10T10:00:00Z"
    }
  ]);

  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);

  // Redirect new users to settings to complete their profile
  useEffect(() => {
    if (!loading && !profileLoading && user && !hasProfile) {
      setCurrentView('settings');
    }
  }, [loading, profileLoading, user, hasProfile]);

  // Mock historical portfolio value data
  const historicalPortfolio = [
    { date: "2024-01-01", pnl: 5000 },
    { date: "2024-01-02", pnl: 5150 },
    { date: "2024-01-03", pnl: 5100 },
    { date: "2024-01-04", pnl: 5400 },
    { date: "2024-01-05", pnl: 5600 },
    { date: "2024-01-06", pnl: 6050 },
    { date: "2024-01-07", pnl: 6370 },
    { date: "2024-01-08", pnl: 6550 },
    { date: "2024-01-09", pnl: 6970 },
    { date: "2024-01-10", pnl: 7350 }
  ];

  // Calculate portfolio value based on trade types and actions
  const portfolioValue = trades.reduce((sum, trade) => {
    if (trade.action === 'Buy' || trade.action === 'Deposit') {
      return sum + trade.value;
    } else if (trade.action === 'Sell' || trade.action === 'Withdraw') {
      return sum - trade.value;
    }
    return sum;
  }, 0);
  
  const openTrades = trades.filter(trade => !trade.closed).length;

  const handleAddTrade = (newTrade: Trade) => {
    setTrades([...trades, newTrade]);
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Authentication Error</div>
          <div className="text-white mb-4">{error}</div>
          <div className="text-[#b3b3b3] text-sm">
            Please check your Supabase configuration and restart the app.
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
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
    switch (currentView) {
      case 'settings':
        return <Settings />;
      case 'weekly-report':
        return (
          <div className="min-h-screen bg-[#0f0f0f] p-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold text-white mb-2">Weekly Report</h1>
              <p className="text-[#b3b3b3]">Weekly performance and analytics will be displayed here.</p>
            </div>
          </div>
        );
      
      case 'overview':
      default:
        return (
          <div className="min-h-screen bg-[#0f0f0f]">
            {/* Header */}
            <header className="py-8">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8 flex justify-between items-center">
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Trading Tracker</h1>
                    <p className="text-[#b3b3b3]">Track your trades and portfolio performance</p>
                  </div>
                  <Button 
                    onClick={() => setIsTradeFormOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Trade
                  </Button>
                </div>
              </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Summary Cards */}
              <div className="mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-[#b3b3b3]">Portfolio Value</CardTitle>
                      <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        <span className={portfolioValue >= 0 ? "text-green-400" : "text-red-400"}>
                          {portfolioValue >= 0 ? "+" : ""}${portfolioValue.toFixed(2)}
                        </span>
                      </div>
                                              <p className="text-xs text-[#b3b3b3]">
                          Current portfolio value
                        </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-[#b3b3b3]">Open Trades</CardTitle>
                      <Activity className="h-4 w-4 text-[#b3b3b3]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">{openTrades}</div>
                      <p className="text-xs text-[#b3b3b3]">
                        Active trades
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Trades</CardTitle>
                      <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">{trades.length}</div>
                      <p className="text-xs text-[#b3b3b3]">
                        Total trades recorded
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-[#b3b3b3]">Trade Types</CardTitle>
                      <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">{new Set(trades.map(t => t.type)).size}</div>
                      <div className="text-xs text-[#b3b3b3]">
                        Different trade types
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* P&L Chart */}
              <div className="mb-8">
                <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
                  <CardHeader>
                                      <CardTitle className="text-white">Portfolio Performance</CardTitle>
                  <CardDescription className="text-[#b3b3b3]">
                    Historical portfolio value over time
                  </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PnLChart data={historicalPortfolio} />
                  </CardContent>
                </Card>
              </div>

              {/* Trades Table */}
              <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
                <CardHeader>
                  <CardTitle className="text-white">Recent Trades</CardTitle>
                  <CardDescription className="text-[#b3b3b3]">
                    Your recent trading activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#404040] scrollbar-track-transparent">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3] whitespace-nowrap">Type</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3] whitespace-nowrap">Action</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3] whitespace-nowrap">Price</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3] whitespace-nowrap">Quantity</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3] whitespace-nowrap">Value</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3] whitespace-nowrap">Strike</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3] whitespace-nowrap">Expiry</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3] whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((trade) => (
                          <tr key={trade.id} className="hover:bg-[#2d2d2d]">
                            <td className="py-3 px-4">
                              <Badge variant={trade.type === "Call" ? "default" : "secondary"}>
                                {trade.type}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={trade.action === "Buy" ? "default" : "destructive"}>
                                {trade.action}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-white">${trade.price}</td>
                            <td className="py-3 px-4 text-white">{trade.quantity}</td>
                            <td className="py-3 px-4 text-white">${trade.value}</td>
                            <td className="py-3 px-4 text-white">{trade.strike ? `$${trade.strike}` : '-'}</td>
                            <td className="py-3 px-4 text-white">{trade.expiry || '-'}</td>
                            <td className="py-3 px-4">
                              <Badge variant={trade.closed ? "outline" : "default"}>
                                {trade.closed ? 'Closed' : 'Open'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </main>
          </div>
        );
    }
  };

  return (
    <div data-1p-ignore data-lpignore="true" data-form-type="other">
      <Sidebar onViewChange={handleViewChange} currentView={currentView} onLogout={signOut} userProfile={profile}>
        {renderViewContent()}

        {/* Only render the form when it's actually open */}
        {isTradeFormOpen && (
          <NewTradeForm
            isOpen={isTradeFormOpen}
            onClose={() => setIsTradeFormOpen(false)}
            onSubmit={handleAddTrade}
          />
        )}
      </Sidebar>
    </div>
  );
}
