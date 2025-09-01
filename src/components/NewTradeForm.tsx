"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeButton, CancelButton } from "@/components/ui/theme-button";
import { X, Plus } from "lucide-react";

interface Trade {
  id: string;
  user_id: string;
  account_id: string;
  type: 'Cash' | 'Shares' | 'CSP' | 'CC' | 'Call' | 'Put';
  action: 'Buy' | 'Sell' | 'Deposit' | 'Withdraw' | 'Adjustment' | 'Assigned' | 'Called Away';
  ticker_id?: string;
  price: number;
  quantity: number;
  value: number;
  strike?: number;
  expiry?: string;
  opened: string;
  closed?: string;
  close_method?: 'Manual' | 'Expired' | 'Assigned' | 'Called Away';
  created: string;
}

interface NewTradeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trade: Trade) => void;
}

export default function NewTradeForm({ isOpen, onClose, onSubmit }: NewTradeFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    type: "Call" as 'Cash' | 'Shares' | 'CSP' | 'CC' | 'Call' | 'Put',
    action: "Buy" as 'Buy' | 'Sell' | 'Deposit' | 'Withdraw' | 'Adjustment' | 'Assigned' | 'Called Away',
    ticker: "",
    price: "",
    quantity: "",
    strike: "",
    expiry: "",
    opened: "",
    notes: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const price = parseFloat(formData.price);
    const quantity = parseInt(formData.quantity);
    const value = formData.type === 'Cash' ? price : price * quantity * (formData.type.includes('Call') || formData.type.includes('Put') ? 100 : 1);
    
    const trade: Trade = {
      id: Date.now().toString(),
      user_id: user?.id || "",
      account_id: "1", // Default to main account for now
      type: formData.type,
      action: formData.action,
      ticker_id: formData.ticker || undefined,
      price: price,
      quantity: quantity,
      value: value,
      strike: formData.strike ? parseFloat(formData.strike) : undefined,
      expiry: formData.expiry || undefined,
      opened: formData.opened || new Date().toISOString().split('T')[0],
      created: new Date().toISOString()
    };
    
    onSubmit(trade);
    setFormData({
      type: "Call",
      action: "Buy",
      ticker: "",
      price: "",
      quantity: "",
      strike: "",
      expiry: "",
      opened: "",
      notes: ""
    });
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Don't render anything if not open - this prevents form elements from persisting in DOM
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Add New Trade</CardTitle>
            <CardDescription>Enter details for your new trade</CardDescription>
          </div>
          <ThemeButton icon={X} size="sm" onClick={onClose}>
            Close
          </ThemeButton>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trade Type *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Cash">Cash</option>
                <option value="Shares">Shares</option>
                <option value="CSP">Cash Secured Put</option>
                <option value="CC">Covered Call</option>
                <option value="Call">Call Option</option>
                <option value="Put">Put Option</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action *
              </label>
              <select
                name="action"
                value={formData.action}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
                <option value="Deposit">Deposit</option>
                <option value="Withdraw">Withdraw</option>
                <option value="Adjustment">Adjustment</option>
                <option value="Assigned">Assigned</option>
                <option value="Called Away">Called Away</option>
              </select>
            </div>

            {formData.type !== 'Cash' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ticker Symbol
                </label>
                <input
                  type="text"
                  name="ticker"
                  value={formData.ticker}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., AAPL"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price per Share/Contract *
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity *
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1"
              />
            </div>

            {(formData.type === 'Call' || formData.type === 'Put' || formData.type === 'CSP' || formData.type === 'CC') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strike Price
                </label>
                <input
                  type="number"
                  name="strike"
                  value={formData.strike}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            )}

            {(formData.type === 'Call' || formData.type === 'Put' || formData.type === 'CSP' || formData.type === 'CC') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  name="expiry"
                  value={formData.expiry}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trade Date *
              </label>
              <input
                type="date"
                name="opened"
                value={formData.opened}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional notes about this trade..."
                rows={3}
              />
            </div>

            <div className="flex space-x-2 pt-4">
              <ThemeButton type="submit" icon={Plus} className="flex-1">
                Add Trade
              </ThemeButton>
              <CancelButton type="button" onClick={onClose} className="flex-1">
                Cancel
              </CancelButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
