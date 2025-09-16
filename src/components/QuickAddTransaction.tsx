'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Modal from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ThemeButton, CancelButton } from '@/components/ui/theme-button';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useAuth } from '@/contexts/AuthContext';
import { CurrencyAmount, CurrencyCode, isValidCurrencyCode } from '@/lib/currency-amount';
import { InstrumentKind, RawTransaction } from '@/types/episodes';

interface QuickAddTransactionProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickAddTransaction({ isOpen, onClose }: QuickAddTransactionProps) {
  const { user } = useAuth();
  const { accounts, addTransactions, refreshPortfolio, getTickerId, ensureTickersExist } = usePortfolio();

  const defaultAccountId = accounts.length > 0 ? accounts[0].id : '';

  const [accountId, setAccountId] = useState<string>(defaultAccountId);
  const [instrumentKind, setInstrumentKind] = useState<InstrumentKind>('SHARES');
  const [side, setSide] = useState<'BUY' | 'SELL' | ''>('BUY');
  const [qty, setQty] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [fees, setFees] = useState<string>('0');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [ticker, setTicker] = useState<string>('');
  const [expiry, setExpiry] = useState<string>('');
  const [strike, setStrike] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAccountId(defaultAccountId);
      setInstrumentKind('SHARES');
      setSide('BUY');
      setQty('');
      setPrice('');
      setFees('0');
      setCurrency('USD');
      setTicker('');
      setExpiry('');
      setStrike('');
      setMemo('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, defaultAccountId]);


  const showTicker = instrumentKind !== 'CASH';
  const showOptionsFields = instrumentKind === 'CALL' || instrumentKind === 'PUT';
  const showSide = instrumentKind !== 'CASH';
  const showPrice = instrumentKind !== 'CASH';

  const canSubmit = useMemo(() => {
    if (!user) return false;
    if (!accountId) return false;
    if (!isValidCurrencyCode(currency)) return false;
    if (!qty || isNaN(parseFloat(qty))) return false;
    if (showSide && (side !== 'BUY' && side !== 'SELL')) return false;
    if (showPrice && (price === '' || isNaN(parseFloat(price)))) return false;
    if (showTicker && !ticker.trim()) return false;
    if (showOptionsFields) {
      if (!expiry) return false;
      if (!strike || isNaN(parseFloat(strike))) return false;
    }
    return true;
  }, [user, accountId, currency, qty, showSide, side, showPrice, price, showTicker, ticker, showOptionsFields, expiry, strike]);

  const handleSubmit = useCallback(async () => {
    if (!user) return;
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setError(null);

      const nowIso = new Date().toISOString();

      let tickerId: string | undefined = undefined;
      if (showTicker && ticker.trim()) {
        const ensured = await ensureTickersExist([ticker.trim().toUpperCase()]);
        tickerId = ensured[ticker.trim().toUpperCase()] || (await getTickerId(ticker.trim().toUpperCase())) || undefined;
      }

      const qtyNum = parseFloat(qty);
      const priceAmt = showPrice ? CurrencyAmount.fromNumber(parseFloat(price), currency) : undefined;
      const feesAmt = CurrencyAmount.fromNumber(parseFloat(fees || '0'), currency);
      const strikeAmt = showOptionsFields ? CurrencyAmount.fromNumber(parseFloat(strike), currency) : undefined;

      const txn: Omit<RawTransaction, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        account_id: accountId,
        timestamp: nowIso,
        instrument_kind: instrumentKind,
        ticker_id: tickerId,
        expiry: showOptionsFields ? expiry : undefined,
        strike: strikeAmt,
        side: showSide ? (side as 'BUY' | 'SELL') : undefined,
        qty: instrumentKind === 'CASH' ? Math.abs(qtyNum) : qtyNum,
        price: priceAmt,
        fees: feesAmt,
        currency,
        memo: memo || undefined
      };

      const result = await addTransactions([txn]);
      if (result.errorCount > 0) {
        throw new Error(result.errors.join('\n'));
      }

      await refreshPortfolio();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  }, [user, canSubmit, accountId, instrumentKind, showTicker, ticker, ensureTickersExist, getTickerId, qty, showPrice, price, fees, currency, showOptionsFields, strike, expiry, side, memo, addTransactions, refreshPortfolio, onClose, showSide]);

  const title = 'Quick Add Transaction';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        {/* Account */}
        <div>
          <label className="text-sm text-[#b3b3b3]">Account</label>
          <Select
            value={accountId}
            onChange={setAccountId}
            options={accounts.map(acc => ({ value: acc.id, label: acc.name }))}
            placeholder="Select account"
            className="w-full mt-1"
          />
        </div>

        {/* Kind - Tab Style */}
        <div>
          <label className="text-sm text-[#b3b3b3] mb-2 block">Kind</label>
          <div className="flex flex-wrap gap-1 mb-3">
            {[
              { value: 'SHARES', label: 'Shares', side: 'BUY' },
              { value: 'CALL', label: 'Call', side: 'BUY' },
              { value: 'PUT', label: 'Put', side: 'BUY' },
              { value: 'CALL', label: 'CC', side: 'SELL' },
              { value: 'PUT', label: 'CSP', side: 'SELL' },
              { value: 'CASH', label: 'Cash', side: '' }
            ].map((option, index) => {
              const isSelected = instrumentKind === option.value && 
                (option.side === '' ? side === '' : side === option.side);
              return (
                <button
                  key={`${option.value}-${option.side}-${index}`}
                  type="button"
                  onClick={() => {
                    setInstrumentKind(option.value as InstrumentKind);
                    setSide(option.side as 'BUY' | 'SELL' | '');
                  }}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    isSelected
                      ? 'bg-[#2d2d2d] border-[#888888] text-white'
                      : 'bg-[#1a1a1a] border-[#2d2d2d] text-[#b3b3b3] hover:border-[#555555] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side and Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-[#b3b3b3]">Side</label>
            <Select
              value={side}
              onChange={v => setSide(v as 'BUY' | 'SELL')}
              options={[{ value: 'BUY', label: 'BUY' }, { value: 'SELL', label: 'SELL' }]}
              placeholder={showSide ? 'Select side' : 'N/A'}
              className="w-full mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-[#b3b3b3]">Currency</label>
            <Input className="mt-1" value={currency} onChange={e => {
              const v = e.target.value.toUpperCase();
              if (isValidCurrencyCode(v)) setCurrency(v as CurrencyCode);
            }} placeholder="USD" />
          </div>
        </div>

        {/* Ticker/Qty/Price */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-[#b3b3b3]">{showTicker ? 'Ticker' : '—'}</label>
            <Input className="mt-1" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder={showTicker ? 'AAPL' : ''} disabled={!showTicker} />
          </div>
          <div>
            <label className="text-sm text-[#b3b3b3]">{instrumentKind === 'CASH' ? 'Amount' : 'Quantity'}</label>
            <Input className="mt-1" value={qty} onChange={e => setQty(e.target.value)} placeholder={instrumentKind === 'CASH' ? '1000' : '10'} />
          </div>
          <div>
            <label className="text-sm text-[#b3b3b3]">{showPrice ? 'Price' : '—'}</label>
            <Input className="mt-1" value={price} onChange={e => setPrice(e.target.value)} placeholder="100.25" disabled={!showPrice} />
          </div>
        </div>

        {/* Options fields */}
        {showOptionsFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-[#b3b3b3]">Expiry (YYYY-MM-DD)</label>
              <Input className="mt-1" value={expiry} onChange={e => setExpiry(e.target.value)} placeholder="2026-01-17" />
            </div>
            <div>
              <label className="text-sm text-[#b3b3b3]">Strike</label>
              <Input className="mt-1" value={strike} onChange={e => setStrike(e.target.value)} placeholder="100" />
            </div>
          </div>
        )}

        {/* Fees and Memo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-[#b3b3b3]">Fees</label>
            <Input className="mt-1" value={fees} onChange={e => setFees(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-sm text-[#b3b3b3]">Memo</label>
            <Textarea className="mt-1" value={memo} onChange={e => setMemo(e.target.value)} placeholder="Optional notes..." />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <CancelButton onClick={onClose} disabled={submitting}>Cancel</CancelButton>
          <ThemeButton onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? 'Adding…' : 'Add Transaction'}
          </ThemeButton>
        </div>
      </div>
    </Modal>
  );
}


