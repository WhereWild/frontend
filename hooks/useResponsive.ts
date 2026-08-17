// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from 'react';
import { Dimensions, Platform } from 'react-native';

import { getResponsive, type ResponsiveResult } from '@/constants/responsive';

// React hook that keeps responsive tokens in sync with runtime viewport width.
export function useResponsive(): ResponsiveResult {
  // getResponsive() (called with no windowWidth) falls back to reading
  // window.innerWidth directly, which is available immediately on the
  // client — including during this component's very first render, i.e.
  // mid-hydration, before any effect has run. SSR has no window and always
  // guesses 'tablet', so trusting the real width this early makes the
  // client's first render disagree with the server-rendered markup. Force
  // the same unknown-width guess SSR made (NaN short-circuits the
  // windowWidth ?? getCurrentWindowWidth() fallback below) until the
  // effect below re-measures post-mount.
  const [responsive, setResponsive] = useState<ResponsiveResult>(() =>
    getResponsive({ windowWidth: NaN }),
  );

  useEffect(() => {
    const update = (width?: number) =>
      setResponsive((prev) => {
        const next = getResponsive({ windowWidth: width });
        // Avoid re-rendering when breakpoint/rootFontSize stay the same.
        if (prev.breakpoint === next.breakpoint && prev.rootFontSize === next.rootFontSize) {
          return prev;
        }
        return next;
      });

    // Re-measure the real viewport now that we're past hydration.
    update();

    // React Native dimensions (works on native and web where available)
    const dimensionHandler = ({ window }: { window: { width?: number } }) => update(window?.width);
    const dimensionsSubscription = Dimensions.addEventListener?.('change', dimensionHandler);

    const removeDimensionListener = () => {
      if (typeof dimensionsSubscription?.remove === 'function') {
        dimensionsSubscription.remove();
        return;
      }

      const maybeLegacyRemove = (Dimensions as { removeEventListener?: unknown }).removeEventListener;
      if (typeof maybeLegacyRemove === 'function') {
        const legacyRemove = maybeLegacyRemove as (type: 'change', handler: typeof dimensionHandler) => void;
        legacyRemove('change', dimensionHandler);
      }
    };

    // Web resize listener for accurate innerWidth
    let removeResize: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onResize = () => update(window.innerWidth);
      window.addEventListener('resize', onResize);
      removeResize = () => {
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          window.removeEventListener('resize', onResize);
        }
      };
    }

    return () => {
      removeDimensionListener();
      removeResize?.();
    };
  }, []);

  return responsive;
}
