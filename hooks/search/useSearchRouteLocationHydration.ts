// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchLocationByGid } from '@/data/apiLocationHelpers';
import { isAbortError } from '@/data/apiShared';
import type { SelectOption } from '@/components';
import type { SearchFilterLocationInitialState } from '@/hooks/search/filters/useSearchFilters';
import { useEffect, useRef } from 'react';

type UseSearchRouteLocationHydrationParams = {
  routeLocation?: string;
  countryValue: string;
  countryOptions: SelectOption[];
  stateValue: string;
  stateOptions: SelectOption[];
  countyValue: string;
  countyOptions: SelectOption[];
  onHydrateRouteLocation: (state?: SearchFilterLocationInitialState) => void;
};

const toOptionSeed = (value: string, label: string) => [{ label, value }];

export function useSearchRouteLocationHydration({
  routeLocation,
  countryValue,
  countryOptions,
  stateValue,
  stateOptions,
  countyValue,
  countyOptions,
  onHydrateRouteLocation,
}: UseSearchRouteLocationHydrationParams) {
  const hydratedRouteLocationRef = useRef<string | null>(null);
  const hydratingRouteLocationRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof routeLocation !== 'string' || routeLocation.length === 0) {
      hydratedRouteLocationRef.current = null;
      hydratingRouteLocationRef.current = null;
      return;
    }

    if (
      hydratedRouteLocationRef.current === routeLocation ||
      hydratingRouteLocationRef.current === routeLocation
    ) {
      return;
    }

    const currentLocationValue = countyValue || stateValue || countryValue;
    const hasCurrentOptionLabels =
      (!countryValue ||
        countryOptions.some((option) => option.value === countryValue)) &&
      (!stateValue ||
        stateOptions.some((option) => option.value === stateValue)) &&
      (!countyValue ||
        countyOptions.some((option) => option.value === countyValue));

    if (currentLocationValue === routeLocation && hasCurrentOptionLabels) {
      hydratedRouteLocationRef.current = routeLocation;
      return;
    }

    hydratingRouteLocationRef.current = routeLocation;
    const controller = new AbortController();

    const hydrateCanonicalRouteLocation = async (retriesRemaining: number) => {
      try {
        const location = await fetchLocationByGid(routeLocation, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        if (!location) {
          hydratedRouteLocationRef.current = routeLocation;
          return;
        }

        hydratedRouteLocationRef.current = routeLocation;

        const countryAncestor = location.ancestors.find(
          (entry) => entry.level === 0,
        );
        const stateAncestor = location.ancestors.find(
          (entry) => entry.level === 1,
        );

        const nextCountryValue =
          countryAncestor?.gid ?? (location.level === 0 ? location.gid : '');
        const nextStateValue =
          stateAncestor?.gid ?? (location.level === 1 ? location.gid : '');
        const nextCountyValue = location.level >= 2 ? location.gid : '';
        const nextCountryOptions =
          nextCountryValue.length > 0
            ? toOptionSeed(
                nextCountryValue,
                countryAncestor?.name ??
                  (location.level === 0 ? location.name : nextCountryValue),
              )
            : [];
        const nextStateOptions =
          nextStateValue.length > 0
            ? toOptionSeed(
                nextStateValue,
                stateAncestor?.name ??
                  (location.level === 1 ? location.name : nextStateValue),
              )
            : [];
        const nextCountyOptions =
          nextCountyValue.length > 0 && location.level >= 2
            ? toOptionSeed(nextCountyValue, location.name)
            : [];
        const isOptionSeedMissing =
          (nextCountryOptions.length > 0 &&
            !countryOptions.some(
              (option) => option.value === nextCountryValue,
            )) ||
          (nextStateOptions.length > 0 &&
            !stateOptions.some((option) => option.value === nextStateValue)) ||
          (nextCountyOptions.length > 0 &&
            !countyOptions.some((option) => option.value === nextCountyValue));

        if (
          countryValue !== nextCountryValue ||
          stateValue !== nextStateValue ||
          countyValue !== nextCountyValue ||
          isOptionSeedMissing
        ) {
          onHydrateRouteLocation({
            countryValue: nextCountryValue,
            stateValue: nextStateValue,
            countyValue: nextCountyValue,
            countryOptions: nextCountryOptions,
            stateOptions: nextStateOptions,
            countyOptions: nextCountyOptions,
          });
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        if (retriesRemaining > 0 && !controller.signal.aborted) {
          await hydrateCanonicalRouteLocation(retriesRemaining - 1);
          return;
        }

        hydratedRouteLocationRef.current = routeLocation;

        console.warn(
          `[search] Failed to hydrate route location "${routeLocation}" from canonical hierarchy`,
          error,
        );
      }
    };

    void hydrateCanonicalRouteLocation(1).finally(() => {
      if (hydratingRouteLocationRef.current === routeLocation) {
        hydratingRouteLocationRef.current = null;
      }
    });

    return () => {
      controller.abort();
      if (hydratingRouteLocationRef.current === routeLocation) {
        hydratingRouteLocationRef.current = null;
      }
    };
  }, [
    countryOptions,
    countryValue,
    countyOptions,
    countyValue,
    onHydrateRouteLocation,
    routeLocation,
    stateOptions,
    stateValue,
  ]);
}
