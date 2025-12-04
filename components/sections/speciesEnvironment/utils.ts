import type { SpeciesEnvironmentHistogram } from '@/data/types';

const MAX_BARS = 12;

export type HistogramBar = {
  index: number;
  start: number;
  end: number;
  count: number;
};

export const buildHistogramBars = (
  histogram: SpeciesEnvironmentHistogram | null,
): HistogramBar[] => {
  if (!histogram) {
    return [];
  }

  const { bins, counts } = histogram;
  if (!bins.length || !counts.length) {
    return [];
  }

  const effectiveCounts = counts.length;
  const limit = Math.min(MAX_BARS, effectiveCounts);

  if (limit === effectiveCounts) {
    return counts.map((count, index) => ({
      index,
      count,
      start: bins[index] ?? 0,
      end: bins[index + 1] ?? bins[index] ?? 0,
    }));
  }

  const indices = Array.from({ length: limit }, (_, idx) => {
    const raw = Math.floor((idx / limit) * effectiveCounts);
    return Math.min(raw, effectiveCounts - 1);
  });

  const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
  return uniqueIndices.map((index) => ({
    index,
    count: counts[index],
    start: bins[index] ?? 0,
    end: bins[index + 1] ?? bins[index] ?? 0,
  }));
};

export const formatValue = (value: number | null | undefined, digits = 0) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatTick = (value: number) => {
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? '0' : rounded.toString();
};

export const formatBinLabel = (start: number, end: number) => {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return '—';
  }

  return `${formatTick(start)} to ${formatTick(end)}`;
};

export const formatFractionPercent = (fraction: number) => {
  if (!Number.isFinite(fraction)) {
    return '0%';
  }

  return `${(fraction * 100).toFixed(1)}%`;
};
