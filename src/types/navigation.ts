export type ViewType = 'overview' | 'weekly-report' | 'settings' | 'shares' | 'transactions' | 'options' | 'data' | 'market-data-demo';

export type PositionFilterType = 'overlap' | 'openedDuring' | 'closedDuring';

export interface PositionFilterOption {
  value: PositionFilterType;
  label: string;
  description: string;
}
