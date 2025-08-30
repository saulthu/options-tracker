"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, DollarSign, Activity } from "lucide-react";
import NewPositionForm from "@/components/NewPositionForm";
import PnLChart from "@/components/PnLChart";
import Sidebar from "@/components/Sidebar";
import LoginForm from "@/components/LoginForm";
import Settings from "@/components/Settings";
import { useAuth } from "@/contexts/AuthContext";

interface Position {
  id: number;
  symbol: string;
  type: "Call" | "Put";
  strike: number;
  expiration: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  status: string;
}

type ViewType = 'overview' | 'weekly-report' | 'settings';

export default function Home() {
  const { user, loading, error, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [positions, setPositions] = useState<Position[]>([
    {
      id: 1,
      symbol: "AAPL",
      type: "Call",
      strike: 150,
      expiration: "2024-01-19",
      quantity: 1,
      entryPrice: 5.50,
      currentPrice: 6.20,
      pnl: 0.70,
      status: "Open"
    },
    {
      id: 2,
      symbol: "TSLA",
      type: "Put",
      strike: 200,
      expiration: "2024-01-26",
      quantity: 2,
      entryPrice: 3.80,
      currentPrice: 2.90,
      pnl: -1.80,
      status: "Open"
    },
    {
      id: 3,
      symbol: "SPY",
      type: "Call",
      strike: 450,
      expiration: "2024-02-16",
      quantity: 1,
      entryPrice: 8.20,
      currentPrice: 12.50,
      pnl: 4.30,
      status: "Open"
    }
  ]);

  const [isFormOpen, setIsFormOpen] = useState(false);

  // Mock historical P&L data
  const historicalPnL = [
    { date: "2024-01-01", pnl: 0 },
    { date: "2024-01-02", pnl: 150 },
    { date: "2024-01-03", pnl: -50 },
    { date: "2024-01-04", pnl: 300 },
    { date: "2024-01-05", pnl: 200 },
    { date: "2024-01-06", pnl: 450 },
    { date: "2024-01-07", pnl: 320 },
    { date: "2024-01-08", pnl: 180 },
    { date: "2024-01-09", pnl: 420 },
    { date: "2024-01-10", pnl: 380 }
  ];

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const openPositions = positions.filter(pos => pos.status === "Open").length;
  const totalValue = positions.reduce((sum, pos) => sum + (pos.currentPrice * pos.quantity), 0);

  const handleAddPosition = (newPosition: Position) => {
    setPositions([...positions, newPosition]);
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
            <header className="bg-[#1a1a1a] shadow-sm border-b border-[#2d2d2d]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-2.5">
                  <div>
                    <h1 className="text-3xl font-bold text-white">Options Tracker</h1>
                    <p className="text-[#b3b3b3]">Track your options positions and performance</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-[#b3b3b3]">Welcome, {user.email}</span>
                    <Button 
                      className="bg-[#2d2d2d] hover:bg-[#404040] text-white border-0"
                      onClick={() => setIsFormOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Position
                    </Button>
                    <Button 
                      variant="outline"
                      className="border-[#404040] text-[#b3b3b3] hover:bg-[#2d2d2d]"
                      onClick={signOut}
                    >
                      Sign Out
                    </Button>
                  </div>
                </div>
              </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {/* Summary Cards */}
              <div className="overflow-x-auto mb-8">
                <div className="flex gap-6 min-w-max pb-2">
                  <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white w-64 flex-shrink-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total P&L</CardTitle>
                      <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        <span className={totalPnL >= 0 ? "text-green-400" : "text-red-400"}>
                          {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-[#b3b3b3]">
                        {totalPnL >= 0 ? "Profitable" : "Loss"} today
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white w-64 flex-shrink-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-[#b3b3b3]">Open Positions</CardTitle>
                      <Activity className="h-4 w-4 text-[#b3b3b3]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">{openPositions}</div>
                      <p className="text-xs text-[#b3b3b3]">
                        Active trades
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white w-64 flex-shrink-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-[#b3b3b3]">Portfolio Value</CardTitle>
                      <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">${totalValue.toFixed(2)}</div>
                      <p className="text-xs text-[#b3b3b3]">
                        Current market value
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white w-64 flex-shrink-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-[#b3b3b3]">Win Rate</CardTitle>
                      <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">67%</div>
                      <div className="text-xs text-[#b3b3b3]">
                        Profitable trades
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* P&L Chart */}
              <div className="mb-8">
                <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
                  <CardHeader>
                    <CardTitle className="text-white">P&L Performance</CardTitle>
                    <CardDescription className="text-[#b3b3b3]">
                      Historical profit and loss over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PnLChart data={historicalPnL} />
                  </CardContent>
                </Card>
              </div>

              {/* Positions Table */}
              <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
                <CardHeader>
                  <CardTitle className="text-white">Open Positions</CardTitle>
                  <CardDescription className="text-[#b3b3b3]">
                    Your current options positions and their performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3]">Symbol</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3]">Type</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3]">Strike</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3]">Expiration</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3]">Quantity</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3]">Entry Price</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3]">Current Price</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3]">P&L</th>
                          <th className="text-left py-3 px-4 font-medium text-[#b3b3b3]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((position) => (
                          <tr key={position.id} className="hover:bg-[#2d2d2d]">
                            <td className="py-3 px-4 font-medium text-white">{position.symbol}</td>
                            <td className="py-3 px-4">
                              <Badge variant={position.type === "Call" ? "default" : "secondary"}>
                                {position.type}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-white">${position.strike}</td>
                            <td className="py-3 px-4 text-white">{position.expiration}</td>
                            <td className="py-3 px-4 text-white">{position.quantity}</td>
                            <td className="py-3 px-4 text-white">${position.entryPrice}</td>
                            <td className="py-3 px-4 text-white">${position.currentPrice}</td>
                            <td className="py-3 px-4">
                              <span className={position.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                                {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline">{position.status}</Badge>
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
    <Sidebar onViewChange={handleViewChange} currentView={currentView} onLogout={signOut}>
      {renderViewContent()}

      <NewPositionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleAddPosition}
      />
    </Sidebar>
  );
}
