export type LengthUnitPreference = 'metric' | 'us-imperial';
export type RainfallUnitPreference = 'metric' | 'us-imperial';
export type TemperatureUnitPreference = 'celsius' | 'fahrenheit' | 'kelvin';

export type MeasurementPreferenceValues = {
  lengthUnits: LengthUnitPreference;
  rainfallUnits: RainfallUnitPreference;
  temperatureUnits: TemperatureUnitPreference;
};

export const DEFAULT_MEASUREMENT_UNITS: MeasurementPreferenceValues = {
  lengthUnits: 'metric',
  rainfallUnits: 'metric',
  temperatureUnits: 'celsius',
};

export const MEASUREMENT_STORAGE_KEYS = {
  lengthUnits: 'settings:length-units',
  rainfallUnits: 'settings:rainfall-units',
  temperatureUnits: 'settings:temperature-units',
} as const;

export type MeasurementPreferenceSnapshot = MeasurementPreferenceValues;
