import { DEFAULT_MEASUREMENT_UNITS, MEASUREMENT_STORAGE_KEYS } from '@/constants/userPreferences';
import type {
  LengthUnitPreference,
  MeasurementPreferenceSnapshot,
  RainfallUnitPreference,
  TemperatureUnitPreference,
} from '@/constants/userPreferences';
import * as React from 'react';
import { usePersistentSetting } from './usePersistentSetting';

export const useMeasurementPreferences = () => {
  const [lengthUnits, setLengthUnits, resetLengthUnits] = usePersistentSetting<LengthUnitPreference>(
    MEASUREMENT_STORAGE_KEYS.lengthUnits,
    DEFAULT_MEASUREMENT_UNITS.lengthUnits,
  );
  const [rainfallUnits, setRainfallUnits, resetRainfallUnits] =
    usePersistentSetting<RainfallUnitPreference>(
      MEASUREMENT_STORAGE_KEYS.rainfallUnits,
      DEFAULT_MEASUREMENT_UNITS.rainfallUnits,
    );
  const [temperatureUnits, setTemperatureUnits, resetTemperatureUnits] =
    usePersistentSetting<TemperatureUnitPreference>(
      MEASUREMENT_STORAGE_KEYS.temperatureUnits,
      DEFAULT_MEASUREMENT_UNITS.temperatureUnits,
    );

  const snapshot: MeasurementPreferenceSnapshot = React.useMemo(
    () => ({
      lengthUnits,
      rainfallUnits,
      temperatureUnits,
    }),
    [lengthUnits, rainfallUnits, temperatureUnits],
  );

  return {
    lengthUnits,
    rainfallUnits,
    temperatureUnits,
    setLengthUnits,
    setRainfallUnits,
    setTemperatureUnits,
    resetLengthUnits,
    resetRainfallUnits,
    resetTemperatureUnits,
    snapshot,
  };
};
