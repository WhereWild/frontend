// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { useOptionalSettings } from '@/context/SettingsContext';
import { fetchPointEnvironmentValue } from '@/data/apiPointLookup';

/** Looks up the raster value for the user's saved home location for the given variable. */
export function useHomeLocationPin({
  selectedVariable,
  units,
}: {
  selectedVariable: string | null | undefined;
  units?: 'metric' | 'imperial' | null;
}) {
  const settings = useOptionalSettings();
  const lat = settings?.localLat ?? null;
  const lon = settings?.localLon ?? null;

  const [homePinValue, setHomePinValue] = React.useState<
    number | string | null
  >(null);
  const [homePinValueLabel, setHomePinValueLabel] = React.useState<
    string | null
  >(null);
  const [homePinLoading, setHomePinLoading] = React.useState(false);

  React.useEffect(() => {
    if (lat == null || lon == null || !selectedVariable) {
      setHomePinValue(null);
      setHomePinValueLabel(null);
      setHomePinLoading(false);
      return;
    }
    let cancelled = false;
    setHomePinLoading(true);
    fetchPointEnvironmentValue(lat, lon, selectedVariable, {
      units: units ?? null,
    })
      .then((result) => {
        if (cancelled) return;
        setHomePinValue(result.value ?? null);
        setHomePinValueLabel(result.valueLabel);
        setHomePinLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHomePinValue(null);
        setHomePinValueLabel(null);
        setHomePinLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lon, selectedVariable, units]);

  return { homePinValue, homePinValueLabel, homePinLoading };
}
