// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mergeSearchHistoryState } from './searchRouteState';

export const getCurrentBrowserSearchUrl = () => {
  if (
    typeof window === 'undefined' ||
    typeof window.location?.pathname !== 'string' ||
    typeof window.location?.search !== 'string'
  ) {
    return null;
  }

  return `${window.location.pathname}${window.location.search}`;
};

// Expo Router can asynchronously replay an older search URL after we normalize it.
// Keep this workaround isolated so the route sync hook can stay focused on ownership.
export const scheduleBrowserSearchUrlReaffirmation = (
  expectedUrl: string,
  staleUrl: string,
  filterVisible: boolean,
) => {
  const cancel = () => {};

  if (
    typeof window === 'undefined' ||
    typeof window.setTimeout !== 'function' ||
    !window.history?.replaceState
  ) {
    return cancel;
  }

  const expectedPathname = expectedUrl.split('?')[0] || expectedUrl;
  const timeoutId = window.setTimeout(() => {
    const currentBrowserSearchUrl = getCurrentBrowserSearchUrl();
    if (
      currentBrowserSearchUrl == null ||
      window.location.pathname !== expectedPathname ||
      currentBrowserSearchUrl === expectedUrl ||
      currentBrowserSearchUrl !== staleUrl
    ) {
      return;
    }

    window.history.replaceState(
      mergeSearchHistoryState(window.history.state, { filterVisible }),
      '',
      expectedUrl,
    );
  }, 0);

  return () => {
    window.clearTimeout(timeoutId);
  };
};
