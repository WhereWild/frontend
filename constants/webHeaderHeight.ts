// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ResponsiveVariant } from '@/constants/responsive';
import { Size } from '@/constants/theme';

// The fixed web header's height isn't known until it's actually laid out
// (see LayoutChromeContext's webHeaderHeight, populated from the header's
// onLayout) — these are its size before that measurement lands: on first
// paint, during SSR (no layout pass runs there at all), or on any hard
// reload/address-bar navigation, where a client-only measurement can't beat
// the browser's own handling (e.g. native `#hash` scrolling) to the punch.
export const WEB_HEADER_HEIGHT_DESKTOP =
  Size.space['1600'] + Size.space['200'] * 2;
export const WEB_HEADER_HEIGHT_COMPACT =
  Size.control.dimension.large + Size.space['400'] * 2;

// Falls back to the breakpoint-derived constant until `measuredWebHeaderHeight`
// (from LayoutChromeContext) reports a real, laid-out value.
export function resolveWebHeaderHeight(
  measuredWebHeaderHeight: number,
  breakpoint: ResponsiveVariant,
): number {
  if (measuredWebHeaderHeight > 0) {
    return measuredWebHeaderHeight;
  }
  return breakpoint === 'desktop'
    ? WEB_HEADER_HEIGHT_DESKTOP
    : WEB_HEADER_HEIGHT_COMPACT;
}
