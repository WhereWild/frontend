// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Study color scheme "global hue, observed luminance/saturation": a value's
// hue comes from where it sits in the variable's GLOBAL range (read off the
// catalog colormap), while its lightness and saturation come from where it
// sits in the species' OBSERVED range, so a narrow-range species still shows
// variation. Both depend only on the value, so the whole scheme is one ramp
// over the observed range — usable as ordinary gradient stops (dotMin/dotMax =
// the observed range), no map changes needed.

type RGB = [number, number, number];

/** matplotlib's coolwarm sampled at 16 even stops (low -> high) — the study's
 * colormap for any temperature variable, whether or not the catalog pins it. */
export const COOLWARM_STOPS: RGB[] = [
  [58, 76, 192],
  [78, 105, 216],
  [100, 133, 235],
  [123, 158, 248],
  [146, 180, 254],
  [170, 198, 253],
  [192, 211, 245],
  [211, 219, 230],
  [229, 216, 208],
  [241, 202, 182],
  [246, 183, 156],
  [245, 160, 129],
  [237, 132, 103],
  [223, 100, 79],
  [204, 63, 57],
  [179, 3, 38],
];

const hexToRgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** 16-stop straight RGB ramp from `low` to `high` (`#rrggbb`). */
const twoColorStops = (low: string, high: string): RGB[] => {
  const a = hexToRgb(low);
  const b = hexToRgb(high);
  return Array.from({ length: 16 }, (_, i) =>
    [0, 1, 2].map((c) => Math.round(a[c] + (i / 15) * (b[c] - a[c]))),
  ) as RGB[];
};

const BROWN = '#8b5a2b';

/** Per-variable thematic ramps (the `thematic` colormap): a metaphor for what
 * the variable is, low -> high. Variables absent here (the temperatures) use
 * coolwarm under `thematic`. */
export const THEMATIC_STOPS: Record<string, RGB[]> = {
  scdur: twoColorStops(BROWN, '#ffffff'), // snow duration (days): brown -> white
  bio12: twoColorStops(BROWN, '#1f6fe0'), // annual precipitation: brown -> blue
  direct_sun: twoColorStops('#000000', '#ffe600'), // direct sunlight: black -> yellow
};

/** The variables whose values are temperatures, i.e. the only ones the fixed
 * degrees-F `custom` / `custom2` bounds presets make sense for. */
export const TEMPERATURE_VARIABLE_IDS = ['bio1', 'bio5', 'bio6'];

/** Fixed temperatures (F) the `center` option can pin the colormap's middle to. */
export const CENTER_F = { zeroF: 0, freezingF: 32, fiftyF: 50 };

/** The `custom` / `custom2` bounds presets, in °F (the study's variables are
 * all temperatures); converted to °C when the study is shown in metric. They
 * apply to whichever variable is shown, not per variable. */
export const CUSTOM_BOUNDS_F = {
  custom: { min: -10, max: 80 },
  custom2: { min: 10, max: 70 },
};

/** One study color configuration — the experiment's independent variables.
 * - colormap: coolwarm, plain viridis, or `thematic` (a per-variable
 *   metaphor ramp, see THEMATIC_STOPS; temperatures stay coolwarm)
 * - bounds: which value range the colormap spans — the variable's global
 *   render min/max, the species' own observed range, or a fixed °F preset
 *   (`custom` -10..80, `custom2` 10..70; see CUSTOM_BOUNDS_F)
 * - observedLumSat: keep `bounds` for hue but let lightness/saturation span
 *   the species' observed range (see the module comment above)
 * - distributionAware: position on the color scale is the value's cumulative
 *   share of global area (area-weighted CDF, see studyDistributions.ts)
 *   within the chosen `bounds`, instead of linear in the value — so a
 *   temperature range holding 5x the area gets 5x the color
 * - center: pin the colormap's middle (e.g. coolwarm's white) at a fixed
 *   temperature (`zeroF` = 0 F, `freezingF` = 32 F, `fiftyF` = 50 F) and interpolate each side
 *   linearly out to the chosen bounds' min and max, instead of the middle
 *   falling at the bounds' midpoint. Temperature variables only; ignored if
 *   the temperature lies outside the bounds. Composes with distributionAware
 *   (the pin and the sides are then in cumulative-area space)
 * - lumSatChannels: which channels the observed range drives — `both`
 *   (lightness and saturation) or `saturation` only (lightness held constant)
 * - lumSatShape: how lightness/saturation run over that range — `sequential`
 *   (pale at the observed min -> vivid at the max) or `diverging` (intensity
 *   grows with distance from the center of `bounds` — the average of its min
 *   and max — so a species straddling the center is pale there and vivid at
 *   both extremes, while one entirely on one side of it runs sequentially
 *   away from the center) */
export type StudyScheme = {
  colormap: 'coolwarm' | 'viridis' | 'thematic';
  bounds: 'global' | 'observed' | 'custom' | 'custom2';
  observedLumSat: boolean;
  distributionAware: boolean;
  center: 'none' | 'zeroF' | 'freezingF' | 'fiftyF';
  lumSatChannels: 'both' | 'saturation';
  lumSatShape: 'sequential' | 'diverging';
};

// Observed min -> pale/muted, observed max -> dark/vivid. Tweak to taste.
const LIGHTNESS_AT_OBSERVED_MIN = 0.85;
const LIGHTNESS_AT_OBSERVED_MAX = 0.4;
// Constant lightness when only saturation varies: the midpoint of the above.
const LIGHTNESS_SATURATION_ONLY =
  (LIGHTNESS_AT_OBSERVED_MIN + LIGHTNESS_AT_OBSERVED_MAX) / 2;
const SATURATION_AT_OBSERVED_MIN = 0.3;
const SATURATION_AT_OBSERVED_MAX = 0.95;
// Unique legend offsets need whole-percent spacing, so 21 stops (every 5%).
const STOP_COUNT = 21;
// Finer ramp for the distribution-aware scale, whose color changes are
// uneven (still whole-percent legend offsets, so at most 101 stops).
export const DISTRIBUTION_STOP_COUNT = 101;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const rgbToHsl = ([r, g, b]: RGB): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d + 6) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
};

const hslToRgb = (h: number, s: number, l: number): RGB => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255)) as RGB;
};

/** Hue (degrees) of a colormap at position t in [0,1]. Interpolates between
 * neighboring stops' hues along the short arc, except where neighbors are far
 * apart (a diverging map's neutral middle, where hue flips cool<->warm):
 * there it snaps to the nearer stop instead of sweeping through unrelated
 * hues. */
const hueAt = (stops: RGB[], t: number): number => {
  const pos = clamp01(t) * (stops.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, stops.length - 1);
  const f = pos - lo;
  const h0 = rgbToHsl(stops[lo])[0];
  const h1 = rgbToHsl(stops[hi])[0];
  let diff = h1 - h0;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  if (Math.abs(diff) > 90) return f < 0.5 ? h0 : h1;
  return (h0 + diff * f + 360) % 360;
};

export type GlobalHueObservedLumSatInput = {
  /** The catalog colormap's stops (low -> high) that supply the hue. */
  globalStops: RGB[];
  globalMin: number;
  globalMax: number;
  observedMin: number;
  observedMax: number;
  shape: StudyScheme['lumSatShape'];
  channels: StudyScheme['lumSatChannels'];
  /** Maps a value to its 0..1 hue position (default: linear over the global
   * range). */
  hueAtValue?: (value: number) => number;
  stopCount?: number;
};

/** Linearly interpolated color of `stops` at position t in [0,1]. */
export const sampleStops = (stops: RGB[], t: number): RGB => {
  const pos = clamp01(t) * (stops.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, stops.length - 1);
  const f = pos - lo;
  return [0, 1, 2].map((c) =>
    Math.round(stops[lo][c] + f * (stops[hi][c] - stops[lo][c])),
  ) as RGB;
};

/** Distribution-aware ramp (low -> high over [min, max]): stop i's color is
 * `stops` sampled at position(value_i), with stops evenly spaced in value, so
 * the map's linear value->stop lookup reproduces the equalized scale. */
export const equalizedStops = (
  stops: RGB[],
  min: number,
  max: number,
  position: (value: number) => number,
): RGB[] =>
  Array.from({ length: DISTRIBUTION_STOP_COUNT }, (_, i) =>
    sampleStops(
      stops,
      position(min + (i / (DISTRIBUTION_STOP_COUNT - 1)) * (max - min)),
    ),
  );

/** Stops (low -> high over the OBSERVED range) for the scheme above. */
export const globalHueObservedLumSatStops = ({
  globalStops,
  globalMin,
  globalMax,
  observedMin,
  observedMax,
  shape,
  channels,
  hueAtValue,
  stopCount = STOP_COUNT,
}: GlobalHueObservedLumSatInput): RGB[] => {
  const globalSpan = globalMax - globalMin || 1;
  const center = (globalMin + globalMax) / 2;
  // The least-intense point: the center itself when the observed range
  // contains it, otherwise the observed end nearest to it (so a one-sided
  // species gets the full pale -> vivid sweep instead of all-vivid).
  const anchor = Math.min(Math.max(center, observedMin), observedMax);
  const farthest =
    Math.max(Math.abs(observedMin - anchor), Math.abs(observedMax - anchor)) ||
    1;
  return Array.from({ length: stopCount }, (_, i) => {
    const position = i / (stopCount - 1);
    const value = observedMin + position * (observedMax - observedMin);
    // 0 = least intense (pale/muted), 1 = most intense (dark/vivid).
    const local =
      shape === 'diverging'
        ? clamp01(Math.abs(value - anchor) / farthest)
        : position;
    const hue = hueAt(
      globalStops,
      hueAtValue ? hueAtValue(value) : (value - globalMin) / globalSpan,
    );
    const saturation =
      SATURATION_AT_OBSERVED_MIN +
      (SATURATION_AT_OBSERVED_MAX - SATURATION_AT_OBSERVED_MIN) * local;
    const lightness =
      channels === 'saturation'
        ? LIGHTNESS_SATURATION_ONLY
        : LIGHTNESS_AT_OBSERVED_MIN +
          (LIGHTNESS_AT_OBSERVED_MAX - LIGHTNESS_AT_OBSERVED_MIN) * local;
    return hslToRgb(hue, saturation, lightness);
  });
};
