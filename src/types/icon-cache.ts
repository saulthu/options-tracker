/**
 * TypeScript types for the icon cache system
 * Handles caching of ticker icons from Polygon.io and Google Favicon service
 */

export type IconSource = 'polygon' | 'favicon' | 'default';

export type IconCacheMetadata = {
  /** Blob storage key for the cached icon */
  blobKey: string;
  /** Direct URL to the blob for fastest access */
  blobUrl?: string;
  /** MIME type of the cached icon */
  contentType: string;
  /** Expiration timestamp in milliseconds */
  expiresAt: number;
  /** Source of the icon (polygon.io or Google Favicon) */
  source: IconSource;
  /** Size of the cached icon in bytes */
  size: number;
  /** When the icon was first cached */
  cachedAt: number;
};

export type IconFetchResult = {
  /** Binary data of the icon */
  bytes: Uint8Array;
  /** MIME type of the icon */
  contentType: string;
  /** Source of the icon */
  source: IconSource;
  /** Size of the icon in bytes */
  size: number;
};

export type PolygonTickerOverview = {
  results?: {
    branding?: {
      icon_url?: string;
    };
    homepage_url?: string;
    name?: string;
    ticker?: string;
  };
};

export type IconCacheConfig = {
  /** Cache TTL in seconds (default: 7 days) */
  ttlSeconds: number;
  /** Fallback favicon size for Google service (default: 128) */
  faviconSize: number;
  /** Maximum icon size in bytes (default: 1MB) */
  maxIconSize: number;
  /** Minimum icon size in bytes (default: 50 bytes) */
  minIconSize: number;
};

export type IconCacheError = {
  error: string;
  detail?: string;
  symbol?: string;
  source?: IconSource;
  timestamp: number;
};

export type IconCacheStats = {
  /** Total number of cached icons */
  totalCached: number;
  /** Number of icons from Polygon.io */
  polygonIcons: number;
  /** Number of icons from Google Favicon */
  faviconIcons: number;
  /** Total cache size in bytes */
  totalSize: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
};

