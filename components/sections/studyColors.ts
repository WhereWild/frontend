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

// Observed min -> pale/muted, observed max -> dark/vivid. Tweak to taste.
const LIGHTNESS_AT_OBSERVED_MIN = 0.85;
const LIGHTNESS_AT_OBSERVED_MAX = 0.4;
const SATURATION_AT_OBSERVED_MIN = 0.3;
const SATURATION_AT_OBSERVED_MAX = 0.95;
// Unique legend offsets need whole-percent spacing, so 21 stops (every 5%).
const STOP_COUNT = 21;

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
};

/** Stops (low -> high over the OBSERVED range) for the scheme above. */
export const globalHueObservedLumSatStops = ({
  globalStops,
  globalMin,
  globalMax,
  observedMin,
  observedMax,
}: GlobalHueObservedLumSatInput): RGB[] => {
  const globalSpan = globalMax - globalMin || 1;
  return Array.from({ length: STOP_COUNT }, (_, i) => {
    const local = i / (STOP_COUNT - 1);
    const value = observedMin + local * (observedMax - observedMin);
    const hue = hueAt(globalStops, (value - globalMin) / globalSpan);
    const saturation =
      SATURATION_AT_OBSERVED_MIN +
      (SATURATION_AT_OBSERVED_MAX - SATURATION_AT_OBSERVED_MIN) * local;
    const lightness =
      LIGHTNESS_AT_OBSERVED_MIN +
      (LIGHTNESS_AT_OBSERVED_MAX - LIGHTNESS_AT_OBSERVED_MIN) * local;
    return hslToRgb(hue, saturation, lightness);
  });
};
