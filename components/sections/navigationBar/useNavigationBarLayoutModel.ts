import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import type { NavigationBarTabVariant } from './NavigationBarTab';
import {
  findTabIndexAtPoint,
  hasHostLayoutChanged,
  shouldRemeasureWidth,
  type HostLayout,
  type TabLayout,
} from './navigationBarHelpers';
import {
  hasAllTabMeasurements,
  updateMeasuredTabWidths,
} from './navigationBarMeasurement';

/**
 * Returns:
 * - variant/measurement state for rendering (`resolvedVariant`, `isMeasuring`)
 * - layout frame data and callbacks (`tabLayouts`, `handleTabsLayout`, `handleTabContainerLayout`, `onTabWidthLayout`)
 * - resize/session utilities (`isResizingRef`, `tabKeySignature`, `getTabIndexAtPoint`)
 */

type TabWithKey = {
  key: string;
};

type ResolveTabVariant = (
  availableWidth: number,
  tabCount: number,
  measuredTabWidths: Record<string, number>,
  tabKeys: string[],
) => NavigationBarTabVariant;

type UseNavigationBarLayoutModelParams<TTab extends TabWithKey> = {
  tabs: TTab[];
  tabKeys: string[];
  resolveTabVariant: ResolveTabVariant;
  resizeSettleDelayMs: number;
  remeasureThresholdPx: number;
};

export type NavigationBarLayoutModel = {
  /** Stable signature of tab keys used for re-measure and host re-sync triggers. */
  tabKeySignature: string;
  /** Current resolved tab layout variant (`horizontal` or `vertical`). */
  resolvedVariant: NavigationBarTabVariant;
  /** True while hidden measurement tabs are collecting widths. */
  isMeasuring: boolean;
  /** Measured frame map for visible tabs used by hit-testing and indicator placement. */
  tabLayouts: Record<string, TabLayout>;
  /** Mutable flag indicating live resize mode for indicator snap behavior. */
  isResizingRef: MutableRefObject<boolean>;
  /** Width measurement callback for a tab key. */
  onTabWidthLayout: (tabKey: string, width: number) => void;
  /** Host layout callback that updates resize state and measurement pipeline. */
  handleTabsLayout: (width: number, height: number) => void;
  /** Frame capture callback for a specific visible tab. */
  handleTabContainerLayout: (tabKey: string, layout: TabLayout) => void;
  /** Local-point hit-test helper used by gesture handling. */
  getTabIndexAtPoint: (x: number, y: number) => number | null;
};

/**
 * Manages layout-derived nav state:
 * tab width measurement, variant resolution, tab frame map, and resize session tracking.
 */
export function useNavigationBarLayoutModel<TTab extends TabWithKey>({
  tabs,
  tabKeys,
  resolveTabVariant,
  resizeSettleDelayMs,
  remeasureThresholdPx,
}: UseNavigationBarLayoutModelParams<TTab>): NavigationBarLayoutModel {
  const tabKeySignature = useMemo(() => tabKeys.join('|'), [tabKeys]);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const [measuredTabWidths, setMeasuredTabWidths] = useState<
    Record<string, number>
  >({});
  const [resolvedVariant, setResolvedVariant] =
    useState<NavigationBarTabVariant>('horizontal');
  const [isMeasuring, setIsMeasuring] = useState(true);
  const [tabLayouts, setTabLayouts] = useState<Record<string, TabLayout>>({});
  const lastHostLayoutRef = useRef<HostLayout | null>(null);
  const deferRemeasureFinalizeRef = useRef(false);
  const isResizingRef = useRef(false);
  const resizeSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearResizeSettleTimeout = useCallback(() => {
    if (!resizeSettleTimeoutRef.current) {
      return;
    }

    clearTimeout(resizeSettleTimeoutRef.current);
    resizeSettleTimeoutRef.current = null;
  }, []);

  useLayoutEffect(() => {
    setTabLayouts({});
  }, [tabKeySignature]);

  useEffect(() => clearResizeSettleTimeout, [clearResizeSettleTimeout]);

  /** Captures measured tab width for horizontal/vertical variant resolution. */
  const onTabWidthLayout = useCallback((tabKey: string, width: number) => {
    setMeasuredTabWidths((previous) =>
      updateMeasuredTabWidths(previous, tabKey, width),
    );
  }, []);

  useEffect(() => {
    if (!isMeasuring || availableWidth === null) {
      return;
    }

    if (tabs.length <= 1) {
      setResolvedVariant('horizontal');
      setIsMeasuring(false);
      deferRemeasureFinalizeRef.current = false;
      return;
    }

    const finalizeMeasurement = () => {
      setResolvedVariant(
        resolveTabVariant(
          availableWidth,
          tabs.length,
          measuredTabWidths,
          tabKeys,
        ),
      );
      setIsMeasuring(false);
      deferRemeasureFinalizeRef.current = false;
    };

    if (hasAllTabMeasurements(tabKeys, measuredTabWidths)) {
      if (deferRemeasureFinalizeRef.current) {
        const deferredFinalize = setTimeout(finalizeMeasurement, 0);
        return () => clearTimeout(deferredFinalize);
      }

      finalizeMeasurement();
      return;
    }

    // Defer one macrotask so late onLayout callbacks (notably on RN/iPadOS)
    // can populate remaining widths before settling with fallback values.
    const finalizeWithFallback = setTimeout(finalizeMeasurement, 0);
    return () => clearTimeout(finalizeWithFallback);
  }, [
    availableWidth,
    isMeasuring,
    measuredTabWidths,
    resolveTabVariant,
    tabKeys,
    tabs.length,
  ]);

  /** Handles host layout changes and starts/stops the short resize session window. */
  const handleTabsLayout = useCallback(
    (width: number, height: number) => {
      if (width <= 0 || height <= 0) {
        return;
      }

      const previousLayout = lastHostLayoutRef.current;
      if (!hasHostLayoutChanged(previousLayout, width, height)) {
        return;
      }

      lastHostLayoutRef.current = { width, height };
      isResizingRef.current = true;

      clearResizeSettleTimeout();

      resizeSettleTimeoutRef.current = setTimeout(() => {
        isResizingRef.current = false;
        resizeSettleTimeoutRef.current = null;
      }, resizeSettleDelayMs);

      setAvailableWidth((previousWidth) => {
        if (!shouldRemeasureWidth(previousWidth, width, remeasureThresholdPx)) {
          return previousWidth;
        }

        deferRemeasureFinalizeRef.current = previousWidth !== null;

        // Preserve last known tab widths while remeasuring to avoid temporary
        // fallback widths causing horizontal/vertical flicker during resize.
        setIsMeasuring(true);
        return width;
      });
    },
    [clearResizeSettleTimeout, remeasureThresholdPx, resizeSettleDelayMs],
  );

  /** Stores each visible tab frame for hit-testing and indicator positioning. */
  const handleTabContainerLayout = useCallback(
    (tabKey: string, layout: TabLayout) => {
      setTabLayouts((previous) => {
        const existing = previous[tabKey];

        if (
          existing &&
          existing.x === layout.x &&
          existing.y === layout.y &&
          existing.width === layout.width &&
          existing.height === layout.height
        ) {
          return previous;
        }

        return {
          ...previous,
          [tabKey]: layout,
        };
      });
    },
    [],
  );

  /** Converts local x/y points into tab indices using latest measured frames. */
  const getTabIndexAtPoint = useCallback(
    (x: number, y: number): number | null =>
      findTabIndexAtPoint(tabs, tabLayouts, x, y),
    [tabLayouts, tabs],
  );

  return {
    tabKeySignature,
    resolvedVariant,
    isMeasuring,
    tabLayouts,
    isResizingRef,
    onTabWidthLayout,
    handleTabsLayout,
    handleTabContainerLayout,
    getTabIndexAtPoint,
  };
}
