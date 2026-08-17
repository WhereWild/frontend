// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ResponsiveVariant } from '@/constants/responsive';
import { resolveWebHeaderHeight } from '@/constants/webHeaderHeight';
import type { TextStyle, ViewStyle } from 'react-native';
import { toKebabCase } from './string';

// Extra breathing room below the fixed web header so an anchored heading
// doesn't sit flush against it.
export const SCROLL_ANCHOR_GAP = 16;

// Web-only affordance: a heading/section renders with a nativeID (-> DOM
// `id` via react-native-web) so in-page `#slug` links and incoming URLs
// with a matching hash can land on it. No native equivalent — there's no
// concept of a URL fragment there.
export function scrollToElementId(id: string) {
  if (typeof document === 'undefined') {
    return;
  }
  document.getElementById(id)?.scrollIntoView();
}

// Style to pair with an anchor target's nativeID: `scroll-margin-top` keeps
// the section clear of the fixed web header, for BOTH scrollIntoView() calls
// and the browser's own native `#hash` navigation — including the one that
// fires on a hard reload/address-bar navigation, before the header has ever
// been laid out and measured (see LayoutChromeContext), let alone before
// React has mounted to correct it. `resolveWebHeaderHeight` falls back to
// the same breakpoint-derived estimate the header shell itself uses for
// that gap, so this lands right the first time rather than needing a
// follow-up JS scroll to fix an initially-wrong offset.
export function anchorScrollMarginStyle(
  webHeaderHeight: number,
  breakpoint: ResponsiveVariant,
): TextStyle & ViewStyle {
  // `scrollMarginTop` isn't in React Native's Text/ViewStyle types — it's a
  // web-only CSS property that react-native-web passes through as-is, and
  // an anchor target can be either a Text (a Markdown/guide heading) or a
  // View (e.g. a whole card, like an About page team member).
  return {
    scrollMarginTop:
      resolveWebHeaderHeight(webHeaderHeight, breakpoint) + SCROLL_ANCHOR_GAP,
  } as TextStyle & ViewStyle;
}

// Slugifies section text into a URL-fragment-safe id, de-duping repeats
// (e.g. two "Overview" sections -> "overview", "overview-1") the same way
// GitHub/marked's own heading-id extensions do. `seenSlugs` should be a
// fresh Map per render pass, shared across every section on that page.
export function slugifySection(
  text: string,
  seenSlugs: Map<string, number>,
): string {
  const base = toKebabCase(text) || 'section';
  const count = seenSlugs.get(base) ?? 0;
  seenSlugs.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}
