// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Opt-in console logging for map debugging. Enabled by
// localStorage.wwMapDebug = '1' (the study pages turn it on themselves); the
// map iframe reads the same flag from its parent window. Off by default.

export const MAP_DEBUG_FLAG = 'wwMapDebug';

export const mapDebugEnabled = (): boolean => {
  try {
    return (
      typeof window !== 'undefined' &&
      window.localStorage.getItem(MAP_DEBUG_FLAG) === '1'
    );
  } catch {
    return false;
  }
};

export const setMapDebug = (on: boolean) => {
  try {
    if (on) window.localStorage.setItem(MAP_DEBUG_FLAG, '1');
    else window.localStorage.removeItem(MAP_DEBUG_FLAG);
  } catch {}
};

export const mapDebugLog = (label: string, extra?: unknown) => {
  if (!mapDebugEnabled()) return;
  console.log(
    '[map-debug:parent]',
    Math.round(performance.now()),
    label,
    extra,
  );
};
