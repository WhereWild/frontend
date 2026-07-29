// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Size } from '@/constants/theme';
import { useScrollLock } from '@/context/ScrollLockContext';
import type { LegendClass, TernaryCompositionDensity } from '@/data/types';
import React from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { ThemedText } from '@/components/text/ThemedText';

const RESPONDER_TEST_ID = 'ternary-density-responder';

/** Last known pointer position on web, tracked globally (module scope, one
 * listener for the whole app) so a chart that mounts — or swaps in — directly
 * under an already-stationary cursor can still initialize its hover state.
 * A plain `mousemove` listener on the chart itself only fires on actual
 * pointer movement, so without this, picking a variable from a selector
 * without then moving the mouse would leave the hover row blank until the
 * user nudged the cursor or clicked (which works only because RN's Responder
 * system fires on mousedown regardless of prior movement). */
let lastPointerPosition: { x: number; y: number } | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener(
    'mousemove',
    (event: MouseEvent) => {
      lastPointerPosition = { x: event.clientX, y: event.clientY };
    },
    { passive: true },
  );
}

const CHART_WIDTH = 260;
const MARGIN = 34;
const SIDE = CHART_WIDTH - 2 * MARGIN;
const TRI_HEIGHT = (SIDE * Math.sqrt(3)) / 2;
const CHART_HEIGHT = TRI_HEIGHT + 2 * MARGIN;
const LEFT_X = MARGIN;
const APEX_X = MARGIN + SIDE / 2;
const TOP_Y = MARGIN;
const BASE_Y = MARGIN + TRI_HEIGHT;

/** Ternary (a, b, c) fractions -> chart-space (x, y). `a` is the top apex,
 * `b` bottom-left, `c` bottom-right — which real-world quantity each letter
 * represents is entirely up to the caller's `axisLabels` prop (e.g. for
 * soil_texture: a=Clay, b=Sand, c=Silt, matching the standard USDA triangle
 * orientation). */
const toXY = (a: number, b: number, c: number): [number, number] => [
  LEFT_X + c * SIDE + a * (SIDE / 2),
  BASE_Y - a * TRI_HEIGHT,
];

/** Inverse of toXY: chart-space (x, y) -> approximate (a, b, c) fractions.
 * Used to resolve a pointer position back to a composition; returns null
 * when the point falls outside the triangle (with a small tolerance for
 * points right on the edge). */
const screenToBary = (
  x: number,
  y: number,
): [number, number, number] | null => {
  const a = (BASE_Y - y) / TRI_HEIGHT;
  const c = (x - LEFT_X - a * (SIDE / 2)) / SIDE;
  const b = 1 - c - a;
  const tolerance = 0.02;
  if (a < -tolerance || b < -tolerance || c < -tolerance) return null;
  return [a, b, c];
};

type GridFace = [number, number, number];

type Mesh = {
  a: number[];
  b: number[];
  c: number[];
  faces: GridFace[];
};

/** Resolved hover/press state: composition is read exactly (a direct,
 * continuous function of pointer position), and density is interpolated
 * across the containing face rather than snapped to a single grid vertex —
 * both track the pointer smoothly instead of stepping between grid points. */
type HoverInfo = {
  a: number;
  b: number;
  c: number;
  density: number | null;
  classId: number | null;
};

/** Reconstructs the canonical barycentric grid from resolution alone — the
 * backend never transmits (a, b, c) coordinates, only densities in this
 * fixed row-major order, so the client must rebuild the same grid. */
const buildMesh = (resolution: number): Mesh => {
  const a: number[] = [];
  const b: number[] = [];
  const c: number[] = [];
  const indexOf = new Map<string, number>();
  let idx = 0;
  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution - i; j++) {
      a.push(i / resolution);
      b.push(j / resolution);
      c.push((resolution - i - j) / resolution);
      indexOf.set(`${i},${j}`, idx);
      idx++;
    }
  }
  const faces: GridFace[] = [];
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution - i; j++) {
      const fa = indexOf.get(`${i},${j}`)!;
      const fb = indexOf.get(`${i + 1},${j}`)!;
      const fc = indexOf.get(`${i},${j + 1}`)!;
      faces.push([fa, fb, fc]);
      const fd = indexOf.get(`${i + 1},${j + 1}`);
      if (fd !== undefined) {
        faces.push([fb, fd, fc]);
      }
    }
  }
  return { a, b, c, faces };
};

const BARY_TOLERANCE = 0.02;

/** Finds the mesh face containing (a, b) and the point's barycentric weights
 * within it (using a/b as the 2D parameterization — c is linearly
 * dependent, c = 1 - a - b). The weights let density be interpolated
 * continuously across the face rather than snapped to whichever grid vertex
 * happens to be closest. */
const findContainingFace = (
  mesh: Mesh,
  a: number,
  b: number,
): { face: GridFace; weights: [number, number, number] } | null => {
  for (const face of mesh.faces) {
    const [i0, i1, i2] = face;
    const [xa, ya] = [mesh.a[i0], mesh.b[i0]];
    const [xb, yb] = [mesh.a[i1], mesh.b[i1]];
    const [xc, yc] = [mesh.a[i2], mesh.b[i2]];
    const denom = (yb - yc) * (xa - xc) + (xc - xb) * (ya - yc);
    if (denom === 0) continue;
    const wa = ((yb - yc) * (a - xc) + (xc - xb) * (b - yc)) / denom;
    const wb = ((yc - ya) * (a - xc) + (xa - xc) * (b - yc)) / denom;
    const wc = 1 - wa - wb;
    if (
      wa >= -BARY_TOLERANCE &&
      wb >= -BARY_TOLERANCE &&
      wc >= -BARY_TOLERANCE
    ) {
      return { face, weights: [wa, wb, wc] };
    }
  }
  return null;
};

/** Nearest grid vertex to an approximate (a, b, c) point — fallback for the
 * rare case a point right on the triangle's boundary tolerance doesn't land
 * inside any face. */
const nearestVertexIndex = (
  mesh: Mesh,
  a: number,
  b: number,
  c: number,
): number => {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < mesh.a.length; i++) {
    const da = mesh.a[i] - a;
    const db = mesh.b[i] - b;
    const dc = mesh.c[i] - c;
    const dist = da * da + db * db + dc * dc;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
};

const CONTOUR_LEVELS = [0.15, 0.35, 0.55, 0.75, 0.9];

/** Marching-triangles contour extraction: one path per density level, made of
 * disconnected short segments (the mesh is coarse enough that stitching
 * segments into continuous loops isn't worth the extra complexity). */
const buildContourPaths = (mesh: Mesh, density: number[]): string[] =>
  CONTOUR_LEVELS.map((level) => {
    const segments: string[] = [];
    for (const [i0, i1, i2] of mesh.faces) {
      const verts: [number, number][] = [
        [i0, i1],
        [i1, i2],
        [i2, i0],
      ];
      const points: [number, number][] = [];
      for (const [v0, v1] of verts) {
        const d0 = density[v0];
        const d1 = density[v1];
        if ((d0 - level) * (d1 - level) < 0) {
          const t = (level - d0) / (d1 - d0);
          const a = mesh.a[v0] + t * (mesh.a[v1] - mesh.a[v0]);
          const b = mesh.b[v0] + t * (mesh.b[v1] - mesh.b[v0]);
          const c = mesh.c[v0] + t * (mesh.c[v1] - mesh.c[v0]);
          points.push(toXY(a, b, c));
        }
      }
      if (points.length === 2) {
        const [[x0, y0], [x1, y1]] = points;
        segments.push(`M ${x0} ${y0} L ${x1} ${y1}`);
      }
    }
    return segments.join(' ');
  });

/** Classification boundary lines. Unlike the continuous density contours
 * above, these aren't approximated from the coarse grid at all — the backend
 * binary-searches along each crossing edge against the real classifier to
 * find the exact composition where the class changes, so the line is
 * straight regardless of the boundary's slope (a fixed grid-edge midpoint
 * only looks right when the true boundary happens to run close to the
 * grid's own diagonal). `classBoundaryA`/`classBoundaryB` are flat, paired
 * arrays: consecutive entries [2k, 2k+1] are one segment's two endpoints. */
const buildClassBoundaryPath = (
  classBoundaryA: number[],
  classBoundaryB: number[],
): string => {
  const segments: string[] = [];
  for (let k = 0; k + 1 < classBoundaryA.length; k += 2) {
    const a0 = classBoundaryA[k];
    const b0 = classBoundaryB[k];
    const a1 = classBoundaryA[k + 1];
    const b1 = classBoundaryB[k + 1];
    const [x0, y0] = toXY(a0, b0, 1 - a0 - b0);
    const [x1, y1] = toXY(a1, b1, 1 - a1 - b1);
    segments.push(`M ${x0} ${y0} L ${x1} ${y1}`);
  }
  return segments.join(' ');
};

/** Representative class for a mesh face — the majority vote among its 3
 * vertices (ties fall back to the first vertex). At this grid resolution,
 * faces spanning more than one class are rare and already marked by the
 * boundary line, so a single representative class is enough for shading. */
const faceClassId = (classIds: number[], face: GridFace): number => {
  const [i0, i1, i2] = face;
  const c0 = classIds[i0];
  const c1 = classIds[i1];
  const c2 = classIds[i2];
  if (c0 === c1 || c0 === c2) return c0;
  if (c1 === c2) return c1;
  return c0;
};

type TernaryDensityChartProps = {
  /** Precomputed ternary KDE density grid, or null if unavailable. */
  density: TernaryCompositionDensity | null;
  /** Corner labels in [top, bottom-left, bottom-right] order — the caller
   * decides which real-world quantity goes where (see the variable's
   * compositionAxis metadata), this component just renders whatever it's given. */
  axisLabels: [string, string, string];
  /** Fill color for the density mesh (brand hue; magnitude is opacity-encoded). */
  fillColor: string;
  /** Stroke color for contour lines and the triangle frame/gridlines. */
  contourColor: string;
  /** Color for corner/edge labels and the occurrence scatter dots. */
  textColor: string;
  /** Overlay the raw occurrence compositions as dots. Off by default — the
   * density mesh + contours read more clearly on their own. */
  showSampleDots?: boolean;
  /** Class legend (id + color), e.g. from selectedVariableMeta.legendClasses.
   * Drives both the class boundary lines (drawn whenever legend data is
   * available) and, optionally, the per-region shading. Omit entirely for a
   * compositional variable with no associated classes — density-only is a
   * valid, supported shape. */
  legendClasses?: LegendClass[] | null;
  /** Lightly shade each region by its class color, underneath the density
   * mesh. Off by default so the density reads as the primary signal. */
  showClassShading?: boolean;
};

/** Renders a 3-part ("ternary") compositional variable's density as a KDE fit
 * in ILR space (so the components' fixed sum is respected) mapped onto a
 * triangle, with a few contour lines, optional classification boundary
 * lines/shading, and (optionally) the actual occurrence compositions
 * overlaid as dots. Generic across any such variable — soil_texture
 * (sand/silt/clay) is the current caller; see SpeciesEnvironmentSection.tsx
 * for how axis labels and legend data are derived from catalog metadata. */
export function TernaryDensityChart({
  density,
  axisLabels,
  fillColor,
  contourColor,
  textColor,
  showSampleDots = false,
  legendClasses = null,
  showClassShading = false,
}: TernaryDensityChartProps) {
  const mesh = React.useMemo(
    () => (density ? buildMesh(density.resolution) : null),
    [density],
  );

  const contourPaths = React.useMemo(
    () => (mesh && density ? buildContourPaths(mesh, density.density) : []),
    [mesh, density],
  );

  const classIds = density?.classIds ?? null;
  const classBoundaryA = density?.classBoundaryA ?? null;
  const classBoundaryB = density?.classBoundaryB ?? null;

  const classBoundaryPath = React.useMemo(
    () =>
      classBoundaryA && classBoundaryB && classBoundaryA.length
        ? buildClassBoundaryPath(classBoundaryA, classBoundaryB)
        : '',
    [classBoundaryA, classBoundaryB],
  );

  const classColorById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const cls of legendClasses ?? []) {
      if (cls.color) map.set(Number(cls.id), cls.color);
    }
    return map;
  }, [legendClasses]);

  const classNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const cls of legendClasses ?? []) {
      map.set(Number(cls.id), cls.name);
    }
    return map;
  }, [legendClasses]);

  const [hoverInfo, setHoverInfo] = React.useState<HoverInfo | null>(null);
  const [renderedSize, setRenderedSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const responderRef = React.useRef<HTMLElement | null>(null);

  const { lockScroll, unlockScroll } = useScrollLock();

  const handleLayout = React.useCallback(
    (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = event.nativeEvent.layout;
      setRenderedSize({ width, height });
    },
    [],
  );

  const resolveHoverInfo = React.useCallback(
    (
      localX: number,
      localY: number,
      width: number,
      height: number,
    ): HoverInfo | null => {
      if (!mesh) return null;
      const scaleX = width ? CHART_WIDTH / width : 1;
      const scaleY = height ? CHART_HEIGHT / height : 1;
      const bary = screenToBary(localX * scaleX, localY * scaleY);
      if (!bary) return null;
      const [a, b, c] = bary;

      const found = findContainingFace(mesh, a, b);
      let densityValue: number | null = null;
      let classId: number | null = null;
      if (found && density) {
        const [i0, i1, i2] = found.face;
        const [wa, wb, wc] = found.weights;
        densityValue =
          wa * density.density[i0] +
          wb * density.density[i1] +
          wc * density.density[i2];
        if (density.classIds)
          classId = faceClassId(density.classIds, found.face);
      } else {
        const idx = nearestVertexIndex(mesh, a, b, c);
        densityValue = density?.density[idx] ?? null;
        classId = density?.classIds ? density.classIds[idx] : null;
      }

      return { a, b, c, density: densityValue, classId };
    },
    [mesh, density],
  );

  // Touch fallback (mobile has no hover concept): press-and-drag over the
  // triangle to explore, same interaction model as this page's other charts.
  const updateHoverFromEvent = React.useCallback(
    (event: GestureResponderEvent) => {
      const { locationX, locationY } = event.nativeEvent;
      const width = renderedSize?.width ?? CHART_WIDTH;
      const height = renderedSize?.height ?? CHART_HEIGHT;
      setHoverInfo(resolveHoverInfo(locationX, locationY, width, height));
    },
    [resolveHoverInfo, renderedSize],
  );

  const handleHoverStart = React.useCallback(
    (event: GestureResponderEvent) => {
      lockScroll();
      updateHoverFromEvent(event);
    },
    [lockScroll, updateHoverFromEvent],
  );

  const clearHover = React.useCallback(() => {
    unlockScroll();
    setHoverInfo(null);
  }, [unlockScroll]);

  // Web: true pointer hover, no press required — matches how a desktop user
  // would expect to explore a chart with the mouse. RN's own Responder system
  // (used above for the touch fallback) only starts from a press, so this is
  // a direct DOM listener rather than a cross-platform RN event. Reads the
  // element off `responderRef` (set via the View's `ref`) rather than
  // `document.querySelector` — the old lookup keyed off the shared
  // `RESPONDER_TEST_ID` constant, which would silently resolve to the wrong
  // instance's node if more than one chart were ever mounted at once.
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !mesh) return;
    const el = responderRef.current;
    if (!el) return;
    const handleMouseMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      setHoverInfo(resolveHoverInfo(localX, localY, rect.width, rect.height));
    };
    const handleMouseLeave = () => setHoverInfo(null);
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    // The chart may have just mounted (or swapped in) directly under a
    // cursor that isn't moving — e.g. right after clicking a variable
    // selector — in which case no mousemove event will fire to populate the
    // hover state. Synthesize one from the last globally tracked pointer
    // position if it currently falls within this chart's bounds.
    if (lastPointerPosition) {
      const rect = el.getBoundingClientRect();
      const { x, y } = lastPointerPosition;
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        setHoverInfo(
          resolveHoverInfo(
            x - rect.left,
            y - rect.top,
            rect.width,
            rect.height,
          ),
        );
      }
    }

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [mesh, resolveHoverInfo]);

  if (!density || !mesh) {
    return (
      <View style={styles.empty}>
        <ThemedText variant='bodySmall'>
          Not enough data for a composition density plot.
        </ThemedText>
      </View>
    );
  }

  const sampleA = density.sampleA ?? [];
  const sampleB = density.sampleB ?? [];
  const sampleC = density.sampleC ?? [];
  const [labelTop, labelBottomLeft, labelBottomRight] = axisLabels;

  return (
    <View style={styles.container}>
      <View style={styles.chartWrapper}>
        <Svg
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        >
          {showClassShading &&
            classIds &&
            classColorById.size > 0 &&
            mesh.faces.map(([i0, i1, i2], i) => {
              const color = classColorById.get(
                faceClassId(classIds, [i0, i1, i2]),
              );
              if (!color) return null;
              const [ax, ay] = toXY(mesh.a[i0], mesh.b[i0], mesh.c[i0]);
              const [bx, by] = toXY(mesh.a[i1], mesh.b[i1], mesh.c[i1]);
              const [cx, cy] = toXY(mesh.a[i2], mesh.b[i2], mesh.c[i2]);
              return (
                <Path
                  key={`class-shade-${i}`}
                  testID='ternary-density-class-shade'
                  d={`M ${ax} ${ay} L ${bx} ${by} L ${cx} ${cy} Z`}
                  fill={color}
                  fillOpacity={0.16}
                />
              );
            })}

          {mesh.faces.map(([i0, i1, i2], i) => {
            const value =
              (density.density[i0] +
                density.density[i1] +
                density.density[i2]) /
              3;
            if (value <= 0) return null;
            const [ax, ay] = toXY(mesh.a[i0], mesh.b[i0], mesh.c[i0]);
            const [bx, by] = toXY(mesh.a[i1], mesh.b[i1], mesh.c[i1]);
            const [cx, cy] = toXY(mesh.a[i2], mesh.b[i2], mesh.c[i2]);
            return (
              <Path
                key={i}
                testID='ternary-density-mesh-face'
                d={`M ${ax} ${ay} L ${bx} ${by} L ${cx} ${cy} Z`}
                fill={fillColor}
                fillOpacity={Math.min(1, value)}
              />
            );
          })}

          {contourPaths.map((d, i) =>
            d ? (
              <Path
                key={`contour-${i}`}
                testID='ternary-density-contour'
                d={d}
                stroke={contourColor}
                strokeWidth={0.75}
                fill='none'
                opacity={0.6}
              />
            ) : null,
          )}

          {classBoundaryPath ? (
            <Path
              testID='ternary-density-class-boundary'
              d={classBoundaryPath}
              stroke={textColor}
              strokeWidth={0.75}
              strokeDasharray='2 2'
              fill='none'
              opacity={0.55}
            />
          ) : null}

          {showSampleDots &&
            sampleA.map((a, i) => {
              const [x, y] = toXY(a, sampleB[i] ?? 0, sampleC[i] ?? 0);
              return (
                <Circle
                  key={`sample-${i}`}
                  testID='ternary-density-sample-dot'
                  cx={x}
                  cy={y}
                  r={1.6}
                  fill={textColor}
                  opacity={0.55}
                />
              );
            })}

          {/* Triangle frame */}
          <Path
            testID='ternary-density-frame'
            d={`M ${APEX_X} ${TOP_Y} L ${LEFT_X + SIDE} ${BASE_Y} L ${LEFT_X} ${BASE_Y} Z`}
            stroke={contourColor}
            strokeWidth={1}
            fill='none'
          />

          {/* Corner labels */}
          <SvgText
            x={APEX_X}
            y={TOP_Y - 10}
            textAnchor='middle'
            fontSize={12}
            fill={textColor}
          >
            {labelTop}
          </SvgText>
          <SvgText
            x={LEFT_X - 6}
            y={BASE_Y + 4}
            textAnchor='end'
            fontSize={12}
            fill={textColor}
          >
            {labelBottomLeft}
          </SvgText>
          <SvgText
            x={LEFT_X + SIDE + 6}
            y={BASE_Y + 4}
            textAnchor='start'
            fontSize={12}
            fill={textColor}
          >
            {labelBottomRight}
          </SvgText>
        </Svg>

        <View
          testID={RESPONDER_TEST_ID}
          ref={responderRef as React.Ref<View>}
          collapsable={false}
          style={styles.responderOverlay}
          onLayout={handleLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleHoverStart}
          onResponderMove={updateHoverFromEvent}
          onResponderRelease={clearHover}
          onResponderTerminate={clearHover}
        />
      </View>

      {hoverInfo ? (
        <ThemedText
          variant='bodySmall'
          style={[styles.hoverRow, { color: textColor }]}
        >
          {`${labelTop} ${Math.round(hoverInfo.a * 100)}% · ${labelBottomLeft} ${Math.round(hoverInfo.b * 100)}% · ${labelBottomRight} ${Math.round(hoverInfo.c * 100)}%`}
          {hoverInfo.classId !== null
            ? ` · ${classNameById.get(hoverInfo.classId) ?? 'Unknown'}`
            : ''}
          {hoverInfo.density !== null
            ? ` · relative density ${hoverInfo.density.toFixed(2)}`
            : ''}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Size.space['200'],
    gap: Size.space['100'],
  },
  chartWrapper: {
    position: 'relative',
  },
  responderOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  hoverRow: {
    textAlign: 'center',
  },
  empty: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
