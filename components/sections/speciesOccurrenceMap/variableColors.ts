// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

export const VIRIDIS_CSS =
  'linear-gradient(to bottom, rgb(253,231,37), rgb(94,201,98), rgb(33,145,140), rgb(59,82,139), rgb(68,1,84))';

export const VIRIDIS_COLORS = [
  'rgb(253,231,37)',
  'rgb(94,201,98)',
  'rgb(33,145,140)',
  'rgb(59,82,139)',
  'rgb(68,1,84)',
];

/** Five anchor stops for SVG LinearGradient — SVG interpolates smoothly between them. */
export const VIRIDIS_STOPS: { offset: string; color: string }[] = [
  { offset: '0%', color: 'rgb(253,231,37)' },
  { offset: '25%', color: 'rgb(94,201,98)' },
  { offset: '50%', color: 'rgb(33,145,140)' },
  { offset: '75%', color: 'rgb(59,82,139)' },
  { offset: '100%', color: 'rgb(68,1,84)' },
];

export const ASPECT_CONIC_CSS =
  'conic-gradient(from 0deg, rgb(40,95,220) 0deg, rgb(42,135,142) 45deg, rgb(45,175,65) 90deg, rgb(142,185,40) 135deg, rgb(240,195,15) 180deg, rgb(230,122,32) 225deg, rgb(220,50,50) 270deg, rgb(130,72,135) 315deg, rgb(40,95,220) 360deg)';

export const ASPECT_NATIVE_COLOR = 'rgb(240,195,15)';

const ASPECT_ANCHORS: [number, [number, number, number]][] = [
  [0, [40, 95, 220]],
  [45, [42, 135, 142]],
  [90, [45, 175, 65]],
  [135, [142, 185, 40]],
  [180, [240, 195, 15]],
  [225, [230, 122, 32]],
  [270, [220, 50, 50]],
  [315, [130, 72, 135]],
  [360, [40, 95, 220]],
];

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function aspectColorAt(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  for (let i = 0; i < ASPECT_ANCHORS.length - 1; i++) {
    const [a0, c0] = ASPECT_ANCHORS[i];
    const [a1, c1] = ASPECT_ANCHORS[i + 1];
    if (d >= a0 && d <= a1) {
      const t = (d - a0) / (a1 - a0);
      return `rgb(${lerpChannel(c0[0], c1[0], t)},${lerpChannel(c0[1], c1[1], t)},${lerpChannel(c0[2], c1[2], t)})`;
    }
  }
  return 'rgb(40,95,220)';
}

/** Midpoint color for each 5° segment (72 total) for SVG conic ring rendering. */
export const ASPECT_RING_SEGMENT_COLORS: string[] = Array.from(
  { length: 72 },
  (_, i) => aspectColorAt(i * 5 + 2.5),
);

/**
 * SVG path string for a donut arc segment.
 * startDeg / endDeg use compass convention: 0° = North (top), clockwise.
 */
export function donutArcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const a1 = toRad(startDeg);
  const a2 = toRad(endDeg);
  const ox1 = cx + outerR * Math.cos(a1),
    oy1 = cy + outerR * Math.sin(a1);
  const ox2 = cx + outerR * Math.cos(a2),
    oy2 = cy + outerR * Math.sin(a2);
  const ix1 = cx + innerR * Math.cos(a1),
    iy1 = cy + innerR * Math.sin(a1);
  const ix2 = cx + innerR * Math.cos(a2),
    iy2 = cy + innerR * Math.sin(a2);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${ox1},${oy1} A${outerR},${outerR},0,${large},1,${ox2},${oy2} L${ix2},${iy2} A${innerR},${innerR},0,${large},0,${ix1},${iy1} Z`;
}
