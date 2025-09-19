/**
 * Icon cache utility functions
 * Provides easy-to-use functions for working with the icon cache system
 */

import { IconCacheStats } from '@/types/icon-cache';

/**
 * Get the URL for a ticker icon from the cache
 * @param symbol - The ticker symbol (e.g., 'AAPL', 'MSFT')
 * @returns The full URL to the cached icon
 */
export function getTickerIconUrl(symbol: string): string {
  if (!symbol) return '';
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/api/icon/${encodeURIComponent(symbol.toUpperCase())}`;
}

/**
 * Get multiple ticker icon URLs at once
 * @param symbols - Array of ticker symbols
 * @returns Object mapping symbols to their icon URLs
 */
export function getTickerIconUrls(symbols: string[]): Record<string, string> {
  return symbols.reduce((acc, symbol) => {
    if (symbol) {
      acc[symbol.toUpperCase()] = getTickerIconUrl(symbol);
    }
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Preload ticker icons for better performance
 * @param symbols - Array of ticker symbols to preload
 * @returns Promise that resolves when all icons are preloaded
 */
export async function preloadTickerIcons(symbols: string[]): Promise<void> {
  const preloadPromises = symbols.map(symbol => {
    if (!symbol) return Promise.resolve();
    
    const iconUrl = getTickerIconUrl(symbol);
    
    // Create a new Image object to trigger preload
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => {
        console.warn(`Failed to preload icon for ${symbol}`);
        resolve(); // Don't reject, just warn
      };
      img.src = iconUrl;
    });
  });
  
  await Promise.allSettled(preloadPromises);
}

/**
 * Get cache statistics (requires server-side execution)
 * @returns Promise with cache statistics
 */
export async function getIconCacheStats(): Promise<IconCacheStats> {
  try {
    const response = await fetch('/api/icon/stats');
    if (!response.ok) {
      throw new Error(`Failed to fetch cache stats: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get icon cache stats:', error);
    return {
      totalCached: 0,
      polygonIcons: 0,
      faviconIcons: 0,
      totalSize: 0,
      hitRate: 0,
    };
  }
}

/**
 * Clear cache for a specific symbol (requires server-side execution)
 * @param symbol - The ticker symbol to clear from cache
 * @returns Promise that resolves when cache is cleared
 */
export async function clearIconCache(symbol: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/icon/${encodeURIComponent(symbol)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error(`Failed to clear cache for ${symbol}:`, error);
    return false;
  }
}

/**
 * Clear all icon cache (requires server-side execution)
 * @returns Promise that resolves when all cache is cleared
 */
export async function clearAllIconCache(): Promise<boolean> {
  try {
    const response = await fetch('/api/icon/clear', {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to clear all icon cache:', error);
    return false;
  }
}
