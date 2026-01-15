import { useEffect, useState } from 'react';
import { Dimensions, Platform } from 'react-native';

import { getResponsive, type ResponsiveResult } from '@/constants/responsive';

// React hook that keeps responsive tokens in sync with runtime viewport width.
export function useResponsive(): ResponsiveResult {
  const [responsive, setResponsive] = useState<ResponsiveResult>(() => getResponsive());

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
      removeResize = () => window.removeEventListener('resize', onResize);
    }

    return () => {
      removeDimensionListener();
      removeResize?.();
    };
  }, []);

  return responsive;
}
