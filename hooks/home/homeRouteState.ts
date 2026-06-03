// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

type HomeHistoryState = {
  filterVisible: boolean;
  activeGroup: string;
};

const HOME_FILTER_VISIBILITY_STORAGE_KEY = 'wherewild.home.filterVisible';
const HOME_ACTIVE_GROUP_STORAGE_KEY = 'wherewild.home.activeGroup';

const toObjectRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

export const getHomeHistoryState = (historyState: unknown): HomeHistoryState => {
  const root = toObjectRecord(historyState);
  const homeState = toObjectRecord(root.home);
  const activeGroup = homeState.activeGroup;

  return {
    filterVisible: homeState.filterVisible === true,
    activeGroup: typeof activeGroup === 'string' && activeGroup.length > 0
      ? activeGroup
      : 'all',
  };
};

export const hasHomeHistoryFilterVisibility = (historyState: unknown) => {
  const root = toObjectRecord(historyState);
  const homeState = toObjectRecord(root.home);

  return typeof homeState.filterVisible === 'boolean';
};

export const hasHomeHistoryActiveGroup = (historyState: unknown) => {
  const root = toObjectRecord(historyState);
  const homeState = toObjectRecord(root.home);

  return typeof homeState.activeGroup === 'string';
};

export const mergeHomeHistoryState = (
  historyState: unknown,
  updates: Partial<HomeHistoryState>,
) => {
  const root = toObjectRecord(historyState);
  const homeState = toObjectRecord(root.home);

  return {
    ...root,
    home: {
      ...homeState,
      ...updates,
    },
  };
};

export const getStoredHomeFilterVisibility = (storage?: Storage | null) => {
  if (!storage) {
    return false;
  }

  // Storage access can throw in restricted browser contexts; fall back to the
  // default UI state instead of surfacing noisy runtime errors.
  try {
    return storage.getItem(HOME_FILTER_VISIBILITY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setStoredHomeFilterVisibility = (
  storage: Storage | null | undefined,
  filterVisible: boolean,
) => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      HOME_FILTER_VISIBILITY_STORAGE_KEY,
      filterVisible ? 'true' : 'false',
    );
  } catch {
    return;
  }
};

export const getStoredHomeActiveGroup = (storage?: Storage | null) => {
  if (!storage) {
    return 'all';
  }

  try {
    const activeGroup = storage.getItem(HOME_ACTIVE_GROUP_STORAGE_KEY);
    return typeof activeGroup === 'string' && activeGroup.length > 0
      ? activeGroup
      : 'all';
  } catch {
    return 'all';
  }
};

export const setStoredHomeActiveGroup = (
  storage: Storage | null | undefined,
  activeGroup: string,
) => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(HOME_ACTIVE_GROUP_STORAGE_KEY, activeGroup);
  } catch {
    return;
  }
};
