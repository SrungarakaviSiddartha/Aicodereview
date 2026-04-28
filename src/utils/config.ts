import type { ReviewConfig } from '../types/index.js';

const VALID_SEVERITY_THRESHOLDS = ['info', 'warning', 'error'] as const;

export type SeverityThreshold = ReviewConfig['severityThreshold'];

export function isSeverityThreshold(value: string): value is SeverityThreshold {
  return VALID_SEVERITY_THRESHOLDS.includes(value as SeverityThreshold);
}

export function parseSeverityThreshold(value: string | undefined): SeverityThreshold {
  if (value && isSeverityThreshold(value)) {
    return value;
  }

  return 'warning';
}