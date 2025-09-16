// Alpaca API Configuration
// This file should be added to .gitignore to keep credentials secure

export interface AlpacaCredentials {
  apiKey: string;
  secretKey: string;
  baseUrl?: string;
  dataUrl?: string;
}

// Default configuration for development
export const defaultAlpacaConfig: AlpacaCredentials = {
  apiKey: process.env.NEXT_PUBLIC_ALPACA_API_KEY || '',
  secretKey: process.env.NEXT_PUBLIC_ALPACA_SECRET_KEY || '',
  baseUrl: process.env.NEXT_PUBLIC_ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
  dataUrl: process.env.NEXT_PUBLIC_ALPACA_DATA_URL || 'https://data.alpaca.markets'
};

// Validate that required credentials are present
export function validateAlpacaConfig(config: AlpacaCredentials): boolean {
  return !!(config.apiKey && config.secretKey);
}

// Get Alpaca configuration from environment variables
export function getAlpacaConfig(): AlpacaCredentials | null {
  const config = defaultAlpacaConfig;
  
  if (!validateAlpacaConfig(config)) {
    console.warn('Alpaca API credentials not found. Please set NEXT_PUBLIC_ALPACA_API_KEY and NEXT_PUBLIC_ALPACA_SECRET_KEY environment variables.');
    return null;
  }
  
  return config;
}
