'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, PieChart, Activity } from "lucide-react";
import { TimeRange } from "./TimeRangeSelector";

interface ReportPageProps {
  selectedRange: TimeRange;
}

export default function ReportPage({ selectedRange }: ReportPageProps) {
  return (
    <div className="space-y-8">
      {/* Performance Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Return</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">+12.5%</div>
            <p className="text-xs text-[#b3b3b3]">
              Period performance
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Win Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">75%</div>
            <p className="text-xs text-[#b3b3b3]">
              Profitable trades
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Avg Return</CardTitle>
            <PieChart className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">+$245</div>
            <p className="text-xs text-[#b3b3b3]">
              Per trade
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Max Drawdown</CardTitle>
            <Activity className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">-5.2%</div>
            <p className="text-xs text-[#b3b3b3]">
              Peak to trough
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Performance Chart */}
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Performance Over Time</CardTitle>
            <CardDescription>
              Portfolio value for {selectedRange.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-[#b3b3b3]">
              Performance chart will be displayed here
            </div>
          </CardContent>
        </Card>

        {/* Trade Distribution */}
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Trade Distribution</CardTitle>
            <CardDescription>
              Trade types and outcomes for {selectedRange.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-[#b3b3b3]">
              Trade distribution chart will be displayed here
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Detailed Analysis</CardTitle>
          <CardDescription>
            Comprehensive performance metrics for {selectedRange.label}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#2d2d2d] rounded-lg">
                <h4 className="font-medium text-white mb-2">Best Performing Strategy</h4>
                <p className="text-sm text-[#b3b3b3]">Covered Calls</p>
                <p className="text-lg font-bold text-green-400">+18.3%</p>
              </div>
              <div className="p-4 bg-[#2d2d2d] rounded-lg">
                <h4 className="font-medium text-white mb-2">Most Active Ticker</h4>
                <p className="text-sm text-[#b3b3b3]">AAPL</p>
                <p className="text-lg font-bold text-white">12 trades</p>
              </div>
              <div className="p-4 bg-[#2d2d2d] rounded-lg">
                <h4 className="font-medium text-white mb-2">Risk-Adjusted Return</h4>
                <p className="text-sm text-[#b3b3b3]">Sharpe Ratio</p>
                <p className="text-lg font-bold text-blue-400">1.42</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



