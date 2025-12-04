import type { SpeciesEnvironmentStats } from '@/data/types';
import type { MeasurementPreferenceSnapshot } from '@/constants/userPreferences';

const METERS_TO_FEET = 3.28084;
const MILLIMETERS_TO_INCHES = 0.0393701;

type MeasurementCategory = 'length' | 'rainfall' | 'temperature' | null;

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeUnit = (unit?: string | null): string => (unit ?? '').trim().toLowerCase();

const getCategoryFromUnit = (unit?: string | null): MeasurementCategory => {
  const normalized = normalizeUnit(unit);
  if (!normalized) {
    return null;
  }
  if (normalized === 'm' || normalized === 'meter' || normalized === 'meters') {
    return 'length';
  }
  if (normalized === 'mm' || normalized === 'millimeter' || normalized === 'millimeters') {
    return 'rainfall';
  }
  if (normalized === 'degc' || normalized === '°c' || normalized === 'celsius') {
    return 'temperature';
  }
  return null;
};

type ValueConverter = (value: number | null | undefined) => number | null;

const identity: ValueConverter = (value) => (isFiniteNumber(value) ? value : value ?? null);

const buildLengthConverter = (
  preference: MeasurementPreferenceSnapshot['lengthUnits'],
): { convert: ValueConverter; units: string } => {
  if (preference === 'us-imperial') {
    return {
      convert: (value) => (isFiniteNumber(value) ? value * METERS_TO_FEET : value ?? null),
      units: 'ft',
    };
  }
  return { convert: identity, units: 'm' };
};

const buildRainfallConverter = (
  preference: MeasurementPreferenceSnapshot['rainfallUnits'],
): { convert: ValueConverter; units: string } => {
  if (preference === 'us-imperial') {
    return {
      convert: (value) => (isFiniteNumber(value) ? value * MILLIMETERS_TO_INCHES : value ?? null),
      units: 'in',
    };
  }
  return { convert: identity, units: 'mm' };
};

const buildTemperatureConverter = (
  preference: MeasurementPreferenceSnapshot['temperatureUnits'],
): { convert: ValueConverter; units: string } => {
  if (preference === 'fahrenheit') {
    return {
      convert: (value) => (isFiniteNumber(value) ? value * 9 / 5 + 32 : value ?? null),
      units: '°F',
    };
  }
  if (preference === 'kelvin') {
    return {
      convert: (value) => (isFiniteNumber(value) ? value + 273.15 : value ?? null),
      units: 'K',
    };
  }
  return {
    convert: identity,
    units: '°C',
  };
};

export const buildMeasurementConverter = (
  unit: string | null | undefined,
  preferences: MeasurementPreferenceSnapshot,
): { convert: ValueConverter; units: string | null; category: MeasurementCategory } => {
  const category = getCategoryFromUnit(unit);
  switch (category) {
    case 'length':
      return { ...buildLengthConverter(preferences.lengthUnits), category };
    case 'rainfall':
      return { ...buildRainfallConverter(preferences.rainfallUnits), category };
    case 'temperature':
      return { ...buildTemperatureConverter(preferences.temperatureUnits), category };
    default:
      return { convert: identity, units: unit ?? null, category: null };
  }
};

const convertHistogram = (bins: number[], convert: ValueConverter): number[] =>
  bins.map((value) => {
    const converted = convert(value);
    return typeof converted === 'number' && Number.isFinite(converted) ? converted : value;
  });

export const convertStatsToPreferredUnits = (
  stats: SpeciesEnvironmentStats,
  preferences: MeasurementPreferenceSnapshot,
): SpeciesEnvironmentStats => {
  const { convert, units: nextUnits, category } = buildMeasurementConverter(stats.units, preferences);
  if (!category) {
    return stats;
  }

  const { summary, histogram } = stats;
  const convertValue = (value: number | null | undefined) =>
    (isFiniteNumber(value) ? convert(value) : value ?? null);

  return {
    ...stats,
    units: nextUnits,
    summary: {
      ...summary,
      min: convertValue(summary.min),
      max: convertValue(summary.max),
      mean: convertValue(summary.mean),
      stddev: convertValue(summary.stddev),
      q10: convertValue(summary.q10),
      q90: convertValue(summary.q90),
    },
    histogram: histogram
      ? {
          ...histogram,
          bins: convertHistogram(histogram.bins, convert),
        }
      : histogram,
  };
};
