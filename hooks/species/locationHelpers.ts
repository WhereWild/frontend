// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LocationSearchResult } from '@/data/types';
import type { SelectOption } from '@/components';

export type LocationOption = SelectOption;

export const getValidLocationGid = (location: LocationSearchResult): string | null => {
  const gid = typeof location.gid === 'string' ? location.gid.trim() : '';
  return gid || null;
};

export const toSanitizedLocation = (
  location: LocationSearchResult,
): LocationSearchResult | null => {
  const gid = getValidLocationGid(location);
  if (!gid) {
    return null;
  }

  const name = typeof location.name === 'string' ? location.name.trim() : '';
  return {
    ...location,
    gid,
    name: name || gid,
  };
};

export const compareLocationsByName = (
  left: LocationSearchResult,
  right: LocationSearchResult,
): number => {
  return String(left.name ?? '').localeCompare(String(right.name ?? ''));
};

export const mapLocationsToOptions = (list: LocationSearchResult[]) => {
  const sanitized: LocationSearchResult[] = [];
  const options: LocationOption[] = [];

  for (const location of list) {
    const safeLocation = toSanitizedLocation(location);
    if (!safeLocation) {
      continue;
    }

    sanitized.push(safeLocation);
    options.push({
      label: safeLocation.name,
      value: safeLocation.gid,
    });
  }

  return { sanitized, options };
};
