// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { ThemedText } from '@/components/text/ThemedText';
import { CIRCULAR_COLORMAPS, donutArcPath } from './variableColors';
import { ShapeMarker } from './ShapeMarker';
import type { ShapeKey } from './cbColors';
import type { LegendRange } from './legendRangeSelection';
import { useCircularDragSelection } from '@/hooks/useCircularDragSelection';
import { mergeRanges } from '@/hooks/rangeMerge';
import { useScrollLock } from '@/context/ScrollLockContext';

/** Dims everything outside a drag-selected angular slice — the complement
 * (unselected) arc, drawn on top of both the web CSS ring and the native
 * SVG ring so neither needs its own selection-aware rendering path. */
const DIM_OVERLAY_FILL = '#00000066';

const RING = 56;
const HOLE = 32;
const SEG_DEG = 5;
const OUTER_R = RING / 2;
const INNER_R = HOLE / 2;

const NSWE_ENTRIES: { dir: string; shape: ShapeKey }[] = [
  { dir: 'N', shape: 'triangle' },
  { dir: 'E', shape: 'arrow' },
  { dir: 'S', shape: 'triangle-down' },
  { dir: 'W', shape: 'diamond' },
];

/** Gaps (in plain, non-wrapping start<=end form) between `sorted` segments
 * within [domainStart, domainEnd] — before the first, between consecutive
 * ones, and after the last. */
function computeLinearGaps(
  sorted: { start: number; end: number }[],
  domainStart: number,
  domainEnd: number,
): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = [];
  let cursor = domainStart;
  for (const seg of sorted) {
    if (seg.start > cursor) {
      gaps.push({ start: cursor, end: seg.start });
    }
    cursor = Math.max(cursor, seg.end);
  }
  if (cursor < domainEnd) {
    gaps.push({ start: cursor, end: domainEnd });
  }
  return gaps;
}

/** The dim (unselected) arcs left over once every selected arc in
 * `mergedArcs` (already merged via rangeMerge's mergeRanges — at most one
 * entry can be a wraparound arc, i.e. start > end) is accounted for.
 *
 * A wraparound arc's own complement is exactly the plain span from its end
 * to its start — any other (non-wrapping) merged arcs must fall inside
 * that span, since mergeRanges guarantees no overlap — so gaps are computed
 * against that narrower domain instead of the full 0–360 when one exists.
 */
function computeDimArcs(
  mergedArcs: { start: number; end: number }[],
): { start: number; end: number }[] {
  const wrapping = mergedArcs.find((r) => r.start > r.end);
  const nonWrapping = mergedArcs
    .filter((r) => r.start <= r.end)
    .sort((a, b) => a.start - b.start);
  if (wrapping) {
    return computeLinearGaps(nonWrapping, wrapping.end, wrapping.start);
  }
  return computeLinearGaps(nonWrapping, 0, 360);
}

type AspectRingSvgProps = {
  size: number;
  arcSegmentColors: string[];
  holeFill: string;
  pinnedValue?: number | null;
};

function AspectRingSvg({
  size,
  arcSegmentColors,
  holeFill,
  pinnedValue,
}: AspectRingSvgProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2;
  const innerR = outerR * (INNER_R / OUTER_R);

  return (
    <Svg width={size} height={size}>
      {arcSegmentColors.map((color, i) => (
        <Path
          key={i}
          d={donutArcPath(
            cx,
            cy,
            outerR,
            innerR,
            i * SEG_DEG,
            (i + 1) * SEG_DEG,
          )}
          fill={color}
        />
      ))}
      <Circle cx={cx} cy={cy} r={innerR} fill={holeFill} />
      {pinnedValue != null && (
        <Line
          x1={cx}
          y1={cy - outerR}
          x2={cx}
          y2={cy - innerR - 1}
          stroke='#fffffff2'
          strokeWidth={2}
          transform={`rotate(${pinnedValue}, ${cx}, ${cy})`}
        />
      )}
    </Svg>
  );
}

type MapCircularLegendProps = {
  pinnedValue?: number | null;
  conicCss?: string;
  arcSegmentColors?: string[];
  shapesEnabled?: boolean;
  markerOutlineEnabled?: boolean;
  nsweColors?: [string, string, string, string];
  /** Drag-selected angular slices (degrees, clockwise from min to max — if
   * min > max the slice wraps through 0°, e.g. min:350, max:20 is a 30°
   * slice facing roughly north), filtering which pixels render on the map —
   * multiple disjoint slices can be active at once (shift/cmd-drag, a
   * ~500ms long-press-to-arm, or every drag on phone — see
   * useCircularDragSelection's forceAdditive — adds a slice instead of
   * replacing the selection). */
  selectedRanges?: LegendRange[];
  onRangeChange?: (
    range: LegendRange | null,
    options?: { additive?: boolean; sessionId?: number; final?: boolean },
  ) => void;
  /** Forces every drag to be additive with no long-press wait — see
   * useCircularDragSelection's own doc comment on why (mobile touchscreen
   * long-press-to-arm reliability). */
  forceAdditive?: boolean;
};

const DEFAULT_CONIC_CSS = CIRCULAR_COLORMAPS['twilight_90'].conicCss;
const DEFAULT_ARC_SEGMENT_COLORS =
  CIRCULAR_COLORMAPS['twilight_90'].arcSegmentColors;

export function MapCircularLegend({
  pinnedValue,
  conicCss,
  arcSegmentColors,
  shapesEnabled = false,
  markerOutlineEnabled = false,
  nsweColors,
  selectedRanges,
  onRangeChange,
  forceAdditive = false,
}: MapCircularLegendProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const bg = palette.background.default.secondary;

  const activeArcColors = arcSegmentColors ?? DEFAULT_ARC_SEGMENT_COLORS;
  const { lockScroll, unlockScroll } = useScrollLock();

  // Same wraparound-aware cumulative-delta drag algorithm PolarDensityChart
  // (species page) uses for its arc selection — see useCircularDragSelection
  // for why a naive "angle at start vs. angle now" comparison can't tell
  // drag direction or handle wraparound correctly. additive/final are now
  // forwarded (previously dropped) so the caller can accumulate multiple
  // disjoint slices instead of always replacing the selection.
  const handleCircularRangeChange = React.useCallback(
    (
      range: { start: number; end: number } | null,
      options?: { additive?: boolean; sessionId?: number; final?: boolean },
    ) => {
      onRangeChange?.(
        range ? { min: range.start, max: range.end } : null,
        options,
      );
    },
    [onRangeChange],
  );
  const responderHandlers = useCircularDragSelection({
    center: { cx: RING / 2, cy: RING / 2 },
    onRangeChange: handleCircularRangeChange,
    onDragStart: lockScroll,
    onDragEnd: unlockScroll,
    forceAdditive,
  });

  // lockScroll/unlockScroll above only stops the *page's* ScrollView from
  // scrolling — it doesn't stop the browser's own native touch-scroll
  // gesture on this element from moving the page first. touch-action:none
  // suppresses that scroll/pan/zoom gesture; -webkit-touch-callout/
  // user-select separately suppress the touchscreen's own long-press
  // callout (text-selection menu, "Add to Reading List", etc), which can
  // otherwise steal/cancel the touch around the same ~500ms mark as our own
  // long-press-to-arm timer. Same fix as PolarDensityChart's own copy of
  // this effect (species page, same underlying useCircularDragSelection).
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !onRangeChange) return;
    const selector = '[data-testid="map-circular-legend-responder"]';
    const styleEl = document.createElement('style');
    styleEl.textContent = `${selector} { touch-action: none !important; -webkit-touch-callout: none !important; -webkit-user-select: none !important; user-select: none !important; }`;
    document.head.appendChild(styleEl);

    const onDocPointerDown = (e: PointerEvent) => {
      const responder = document.querySelector(selector);
      if (
        responder &&
        (e.target === responder || responder.contains(e.target as Node))
      ) {
        responder.setPointerCapture(e.pointerId);
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown, {
      capture: true,
    });

    return () => {
      styleEl.remove();
      document.removeEventListener('pointerdown', onDocPointerDown, {
        capture: true,
      });
    };
  }, [onRangeChange]);

  // The dim (unselected) arcs — the complement of the union of every
  // selected slice, so any number of disjoint selections dims correctly
  // (not just one contiguous complement arc).
  const dimArcs =
    selectedRanges && selectedRanges.length > 0
      ? computeDimArcs(
          mergeRanges(
            selectedRanges.map((r) => ({ start: r.min, end: r.max })),
          ),
        )
      : [];

  return (
    <View style={[styles.overlay, { backgroundColor: bg }]}>
      <ThemedText variant='bodyTiny' style={styles.cardinal}>
        N
      </ThemedText>
      <View style={styles.row}>
        <ThemedText variant='bodyTiny' style={styles.cardinal}>
          W
        </ThemedText>
        <View style={{ position: 'relative', width: RING, height: RING }}>
          {Platform.OS === 'web' ? (
            <>
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    borderRadius: RING / 2,
                    backgroundImage: conicCss ?? DEFAULT_CONIC_CSS,
                  } as object,
                ]}
              />
              <View
                style={[
                  styles.hole,
                  {
                    width: HOLE,
                    height: HOLE,
                    borderRadius: HOLE / 2,
                    backgroundColor: bg,
                  },
                ]}
              />
              {pinnedValue != null && (
                <View
                  style={[
                    styles.needle,
                    { transform: `rotate(${pinnedValue}deg)` } as object,
                  ]}
                />
              )}
            </>
          ) : (
            <AspectRingSvg
              size={RING}
              arcSegmentColors={activeArcColors}
              holeFill={bg}
              pinnedValue={pinnedValue}
            />
          )}
          {dimArcs.length > 0 && (
            <Svg
              width={RING}
              height={RING}
              style={StyleSheet.absoluteFillObject}
            >
              {dimArcs.map((arc, i) => (
                <Path
                  key={i}
                  d={donutArcPath(
                    RING / 2,
                    RING / 2,
                    OUTER_R,
                    INNER_R,
                    arc.start,
                    arc.end,
                  )}
                  fill={DIM_OVERLAY_FILL}
                />
              ))}
            </Svg>
          )}
          {onRangeChange && (
            <View
              testID='map-circular-legend-responder'
              style={StyleSheet.absoluteFillObject}
              {...responderHandlers}
            />
          )}
        </View>
        <ThemedText variant='bodyTiny' style={styles.cardinal}>
          E
        </ThemedText>
      </View>
      <ThemedText variant='bodyTiny' style={styles.cardinal}>
        S
      </ThemedText>
      {shapesEnabled && (
        <View style={styles.nsweGrid}>
          {NSWE_ENTRIES.map(({ dir, shape }, i) => (
            <View key={dir} style={styles.nsweItem}>
              <ShapeMarker
                shape={shape}
                color={nsweColors ? nsweColors[i] : '#888888'}
                size={10}
                outline={markerOutlineEnabled}
              />
              <ThemedText variant='bodyTiny' style={styles.nsweLabel}>
                {dir}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 8,
    top: 82,
    zIndex: 1000,
    borderRadius: Size.radius['400'],
    padding: Size.space['200'],
    alignItems: 'center',
    gap: 2,
    pointerEvents: 'box-none',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardinal: {
    textAlign: 'center',
    opacity: 0.85,
  },
  needle: {
    position: 'absolute',
    width: 2,
    height: RING / 2,
    left: RING / 2 - 1,
    top: 0,
    backgroundColor: '#fffffff2',
    opacity: 0.9,
    transformOrigin: 'center bottom',
  } as object,
  hole: {
    position: 'absolute',
    top: (RING - HOLE) / 2,
    left: (RING - HOLE) / 2,
  },
  nsweGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 56,
    gap: 4,
    justifyContent: 'space-between',
  },
  nsweItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    width: 24,
  },
  nsweLabel: {
    opacity: 0.85,
  },
});
