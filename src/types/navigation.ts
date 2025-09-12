export type ViewType = 'overview' | 'weekly-report' | 'settings' | 'shares' | 'transactions' | 'transactions-debug' | 'options';

export type PositionFilterType = 'overlap' | 'openedDuring' | 'closedDuring';

export interface PositionFilterOption {
  value: PositionFilterType;
  label: string;
  description: string;
}
