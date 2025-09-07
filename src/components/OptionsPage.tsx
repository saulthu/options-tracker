'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar, DollarSign, Activity } from "lucide-react";
import { TimeRange } from "./TimeRangeSelector";

interface OptionsPageProps {
  selectedRange: TimeRange;
}

export default function OptionsPage({ selectedRange }: OptionsPageProps) {
  // Mock options data
  const optionsTrades = [
    {
      id: "1",
      ticker: "AAPL",
      type: "CC",
      strike: 150,
      expiry: "2024-02-16",
      quantity: 1,
      premium: 2.50,
      status: "Open",
      daysToExpiry: 12
    },
    {
      id: "2", 
      ticker: "TSLA",
      type: "CSP",
      strike: 200,
      expiry: "2024-02-23",
      quantity: 2,
      premium: 4.20,
      status: "Open",
      daysToExpiry: 19
    },
    {
      id: "3",
      ticker: "NVDA",
      type: "CC",
      strike: 500,
      expiry: "2024-01-26",
      quantity: 1,
      premium: 8.75,
      status: "Closed",
      daysToExpiry: 0
    }
  ];

  const openOptions = optionsTrades.filter(trade => trade.status === "Open");
  const totalPremium = optionsTrades.reduce((sum, trade) => sum + (trade.premium * trade.quantity * 100), 0);

  return (
    <div className="space-y-8">
      {/* Options Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Open Positions</CardTitle>
            <Activity className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{openOptions.length}</div>
            <p className="text-xs text-[#b3b3b3]">
              Active options
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Total Premium</CardTitle>
            <DollarSign className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">${totalPremium.toFixed(2)}</div>
            <p className="text-xs text-[#b3b3b3]">
              Collected premium
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Covered Calls</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {optionsTrades.filter(t => t.type === "CC").length}
            </div>
            <p className="text-xs text-[#b3b3b3]">
              CC positions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#b3b3b3]">Cash Secured Puts</CardTitle>
            <Calendar className="h-4 w-4 text-[#b3b3b3]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {optionsTrades.filter(t => t.type === "CSP").length}
            </div>
            <p className="text-xs text-[#b3b3b3]">
              CSP positions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Options Table */}
      <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Options Positions</CardTitle>
          <CardDescription>
            Current and recent options trades for {selectedRange.label}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2d2d2d]">
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Ticker</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Type</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Strike</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Expiry</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Quantity</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Premium</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">Status</th>
                  <th className="text-left py-3 px-4 text-[#b3b3b3]">DTE</th>
                </tr>
              </thead>
              <tbody>
                {optionsTrades.map((trade) => (
                  <tr key={trade.id} className="border-b border-[#2d2d2d] hover:bg-[#2d2d2d]">
                    <td className="py-3 px-4 text-white font-medium">{trade.ticker}</td>
                    <td className="py-3 px-4 text-white">{trade.type}</td>
                    <td className="py-3 px-4 text-white">${trade.strike}</td>
                    <td className="py-3 px-4 text-white">
                      {new Date(trade.expiry).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-white">{trade.quantity}</td>
                    <td className="py-3 px-4 text-white">${trade.premium.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <Badge variant={trade.status === "Open" ? "default" : "secondary"}>
                        {trade.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-white">
                      {trade.daysToExpiry > 0 ? `${trade.daysToExpiry} days` : "Expired"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Options Strategy Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Strategy Performance</CardTitle>
            <CardDescription>
              Returns by options strategy for {selectedRange.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-[#2d2d2d] rounded-lg">
                <div>
                  <p className="font-medium text-white">Covered Calls</p>
                  <p className="text-sm text-[#b3b3b3]">Income generation</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-400">+12.3%</p>
                  <p className="text-xs text-[#b3b3b3]">Annualized</p>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#2d2d2d] rounded-lg">
                <div>
                  <p className="font-medium text-white">Cash Secured Puts</p>
                  <p className="text-sm text-[#b3b3b3]">Stock acquisition</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-400">+8.7%</p>
                  <p className="text-xs text-[#b3b3b3]">Annualized</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1a1a1a] border-[#2d2d2d] text-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Expiry Calendar</CardTitle>
            <CardDescription>
              Upcoming options expirations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {openOptions.map((trade) => (
                <div key={trade.id} className="flex justify-between items-center p-3 bg-[#2d2d2d] rounded-lg">
                  <div>
                    <p className="font-medium text-white">{trade.ticker} {trade.type}</p>
                    <p className="text-sm text-[#b3b3b3]">${trade.strike} strike</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {new Date(trade.expiry).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-[#b3b3b3]">
                      {trade.daysToExpiry} days
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



