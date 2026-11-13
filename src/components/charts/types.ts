export interface ChartPoint {
  t: number; // ms timestamp
  v: number;
  outlier?: boolean;
}

export interface ChartSeries {
  id: string;
  label?: string;
  /** defaults to theme series colors in order */
  color?: string;
  /** raw entries, drawn as small dots (outliers hollow/muted) */
  raw?: ChartPoint[];
  /** smoothed trend, drawn as the main line */
  trend?: ChartPoint[];
  /** aggregation used when type === 'bars' (weekly buckets). default 'mean' */
  agg?: 'mean' | 'sum';
}

export type ChartType = 'line' | 'dots' | 'bars';

export interface TrendChartProps {
  series: ChartSeries[];
  /** 'line' = trend line + faint raw dots (default), 'dots' = raw dots only + thin trend, 'bars' = weekly bars */
  type?: ChartType;
  height?: number;
  /** visible x-range; defaults to data extent */
  from?: number;
  to?: number;
  /** pinch-zoom + pan on the x axis (History/Exercise screens); dashboard charts are static */
  zoomable?: boolean;
  /** y tick/label formatter in display units, e.g. v => f.bw(v) */
  formatY?: (v: number) => string;
  /** convert stored value → display value before plotting (e.g. kg→lb). default identity */
  toDisplay?: (v: number) => number;
  /** optional horizontal goal line (stored units) */
  goal?: number | null;
  /** zero baseline line, e.g. for strength index % */
  zeroLine?: boolean;
  /** tap/scrub selection callback; null when cleared */
  onSelect?: (sel: { seriesId: string; t: number; v: number } | null) => void;
  /** compact styling for dashboard cards */
  compact?: boolean;
}
