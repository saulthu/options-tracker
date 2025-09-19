/**
 * TickerIcon component for displaying cached ticker icons
 * Integrates with the icon cache system
 */

'use client';

import React, { useState, useCallback } from 'react';
import { getTickerIconUrl } from '@/lib/icon-cache';

// Helper function to get icon URL with fallback
function getIconUrl(symbol: string): string {
  // Use the full cache system
  return getTickerIconUrl(symbol);
}

interface TickerIconProps {
  /** The ticker symbol to display */
  symbol: string;
  /** Size of the icon in pixels */
  size?: number;
  /** CSS class name for additional styling */
  className?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Fallback icon when loading fails */
  fallbackIcon?: React.ReactNode;
  /** Whether to show a loading state */
  showLoading?: boolean;
  /** Callback when icon loads successfully */
  onLoad?: () => void;
  /** Callback when icon fails to load */
  onError?: (error: Error) => void;
}

export function TickerIcon({
  symbol,
  size = 32,
  className = '',
  alt,
  fallbackIcon,
  showLoading = true,
  onLoad,
  onError,
}: TickerIconProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const iconUrl = getIconUrl(symbol);
  const displayAlt = alt || `${symbol} ticker icon`;

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    const errorObj = new Error(`Failed to load icon for ${symbol}`);
    onError?.(errorObj);
  }, [symbol, onError]);

  // Show loading state
  if (isLoading && showLoading) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`}
        style={{ width: size, height: size }}
        aria-label={`Loading ${symbol} icon`}
      >
        <div className="w-1/2 h-1/2 bg-gray-300 dark:bg-gray-600 rounded" />
      </div>
    );
  }

  // Show error state with fallback
  if (hasError) {
    if (fallbackIcon) {
      return <>{fallbackIcon}</>;
    }
    
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400 text-xs font-medium ${className}`}
        style={{ width: size, height: size }}
        title={`Failed to load icon for ${symbol}`}
      >
        {symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={displayAlt}
      width={size}
      height={size}
      className={`rounded ${className}`}
      onLoad={handleLoad}
      onError={handleError}
      loading="lazy"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
      }}
    />
  );
}

/**
 * TickerIconGrid component for displaying multiple ticker icons
 */
interface TickerIconGridProps {
  /** Array of ticker symbols */
  symbols: string[];
  /** Size of each icon */
  iconSize?: number;
  /** Number of columns in the grid */
  columns?: number;
  /** CSS class name for the grid container */
  className?: string;
  /** Callback when all icons are loaded */
  onAllLoaded?: () => void;
}

export function TickerIconGrid({
  symbols,
  iconSize = 32,
  columns = 4,
  className = '',
  onAllLoaded,
}: TickerIconGridProps) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const handleIconLoad = useCallback(() => {
    setLoadedCount(prev => {
      const newCount = prev + 1;
      if (newCount + errorCount === symbols.length) {
        onAllLoaded?.();
      }
      return newCount;
    });
  }, [symbols.length, errorCount, onAllLoaded]);

  const handleIconError = useCallback(() => {
    setErrorCount(prev => {
      const newCount = prev + 1;
      if (loadedCount + newCount === symbols.length) {
        onAllLoaded?.();
      }
      return newCount;
    });
  }, [symbols.length, loadedCount, onAllLoaded]);

  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
    >
      {symbols.map((symbol) => (
        <div key={symbol} className="flex flex-col items-center">
          <TickerIcon
            symbol={symbol}
            size={iconSize}
            onLoad={handleIconLoad}
            onError={handleIconError}
          />
          <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {symbol}
          </span>
        </div>
      ))}
    </div>
  );
}
