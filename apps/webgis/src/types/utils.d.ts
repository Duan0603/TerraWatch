/**
 * TypeScript Declarations for TerraWatch WebGIS Utility Modules
 * Mirrors runtime contracts in src/utils/{time,csv,reportExport,forecastStatus,weather}.js
 */

export interface CsvColumn<T = Record<string, unknown>> {
  label: string;
  value: (row: T) => unknown;
}

export type ForecastLifecycleState = 'superseded' | 'expired' | 'unavailable' | 'fresh';

export type WeatherCategory =
  | 'unknown'
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

export interface WeatherInterpretation {
  kind: WeatherCategory;
  label: string;
}

export interface RainLevel24hResult {
  level: 'below' | 'heavy' | 'very-heavy';
  label: string;
}

export declare function fmtVN(iso?: string | null): string;
export declare function fmtUtc(iso?: string | null): string;
export declare function hourVN(iso: string): string;
export declare function relativeToNow(iso: string, now?: number): string;

export declare function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string;
export declare function downloadCsv(filename: string, text: string): void;
export declare const FORECAST_COLUMNS: CsvColumn[];
export declare const AUDIT_COLUMNS: CsvColumn[];
export declare const HISTORY_COLUMNS: CsvColumn[];
export declare function exportReport<T>(name: string, columns: CsvColumn<T>[], rows: T[]): void;

export declare function reasonText(reason?: string | null): string;
export declare function forecastState(event: {
  status?: string;
  expired?: boolean;
  availability?: string;
}): ForecastLifecycleState;

export declare function weatherKind(code?: number | null): WeatherInterpretation;
export declare function dayLabel(isoDate: string, index: number): string;
export declare function rainLevel24h(mm?: number | null): RainLevel24hResult | null;
export declare function hourLabel(iso: string): string;
export declare function scoreText(v?: number | null): string;
export declare function numberText(value?: number | null, unit?: string, digits?: number): string;
