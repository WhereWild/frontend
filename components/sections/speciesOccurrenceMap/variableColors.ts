// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

export type ColormapId = 'viridis' | 'plasma' | 'inferno' | 'magma' | 'cividis';

export type ColormapDef = {
  id: ColormapId;
  label: string;
  /** 16 RGB stops sampled evenly from matplotlib, low→high */
  stops: [number, number, number][];
  /** CSS linear-gradient for a vertical bar (top = max, bottom = min) */
  barCss: string;
  /** CSS linear-gradient for a horizontal swatch (left = min, right = max) */
  swatchCss: string;
};

// Stops precomputed from matplotlib at 16 evenly-spaced samples.
const VIRIDIS_STOPS: [number, number, number][] = [
  [68,1,84],[72,26,108],[71,47,125],[65,68,135],[57,86,140],[49,104,142],
  [42,120,142],[35,136,142],[31,152,139],[34,168,132],[53,183,121],[84,197,104],
  [122,209,81],[165,219,54],[210,226,27],[253,231,37],
];
const PLASMA_STOPS: [number, number, number][] = [
  [13,8,135],[51,5,151],[80,2,162],[106,0,168],[132,5,167],[156,23,158],
  [177,42,144],[195,61,128],[211,81,113],[225,100,98],[237,121,83],[246,143,68],
  [252,166,54],[254,192,41],[249,220,36],[240,249,33],
];
const INFERNO_STOPS: [number, number, number][] = [
  [0,0,4],[12,8,38],[36,12,79],[66,10,104],[93,18,110],[120,28,109],
  [147,38,103],[174,48,92],[199,62,76],[221,81,58],[237,105,37],[248,133,15],
  [252,165,10],[250,198,45],[242,230,97],[252,255,164],
];
const MAGMA_STOPS: [number, number, number][] = [
  [0,0,4],[11,9,36],[32,17,75],[59,15,112],[87,21,126],[114,31,129],
  [140,41,129],[168,50,125],[196,60,117],[222,73,104],[241,96,93],[250,127,94],
  [254,159,109],[254,191,132],[253,222,160],[252,253,191],
];
const CIVIDIS_STOPS: [number, number, number][] = [
  [0,34,78],[0,46,108],[30,58,111],[53,69,108],[71,81,108],[87,93,109],
  [102,105,112],[117,117,117],[132,130,121],[148,142,119],[165,156,116],
  [183,169,110],[200,184,102],[219,199,90],[238,214,73],[254,232,56],
];

function makeBarCss(stops: [number, number, number][]): string {
  const reversed = [...stops].reverse();
  const parts = reversed.map((s) => `rgb(${s[0]},${s[1]},${s[2]})`);
  return `linear-gradient(to bottom, ${parts.join(', ')})`;
}

function makeSwatchCss(stops: [number, number, number][]): string {
  const parts = stops.map((s) => `rgb(${s[0]},${s[1]},${s[2]})`);
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

export const COLORMAPS: Record<ColormapId, ColormapDef> = {
  viridis: { id: 'viridis', label: 'Viridis', stops: VIRIDIS_STOPS, barCss: makeBarCss(VIRIDIS_STOPS), swatchCss: makeSwatchCss(VIRIDIS_STOPS) },
  plasma:  { id: 'plasma',  label: 'Plasma',  stops: PLASMA_STOPS,  barCss: makeBarCss(PLASMA_STOPS),  swatchCss: makeSwatchCss(PLASMA_STOPS) },
  inferno: { id: 'inferno', label: 'Inferno', stops: INFERNO_STOPS, barCss: makeBarCss(INFERNO_STOPS), swatchCss: makeSwatchCss(INFERNO_STOPS) },
  magma:   { id: 'magma',   label: 'Magma',   stops: MAGMA_STOPS,   barCss: makeBarCss(MAGMA_STOPS),   swatchCss: makeSwatchCss(MAGMA_STOPS) },
  cividis: { id: 'cividis', label: 'Cividis', stops: CIVIDIS_STOPS, barCss: makeBarCss(CIVIDIS_STOPS), swatchCss: makeSwatchCss(CIVIDIS_STOPS) },
};

export const COLORMAP_ORDER: ColormapId[] = ['viridis', 'plasma', 'inferno', 'magma', 'cividis'];

export const DEFAULT_COLORMAP: ColormapId = 'viridis';

// Legacy exports kept for MapVariableLegend (will be replaced by colormap-aware versions)
export const VIRIDIS_CSS = COLORMAPS.viridis.barCss;
export const VIRIDIS_COLORS = VIRIDIS_STOPS.slice().reverse().map((s) => `rgb(${s[0]},${s[1]},${s[2]})`);

// ---------------------------------------------------------------------------
// Circular (aspect) colormaps
// ---------------------------------------------------------------------------

export type CircularColormapId = 'twilight' | 'twilight_90' | 'twilight_180' | 'twilight_270';

export type CircularColormapDef = {
  id: CircularColormapId;
  label: string;
  /** RGB stops sampled evenly over [0°, 360°) — wraps back to stops[0] */
  stops: [number, number, number][];
  /** CSS conic-gradient for a compass rose preview */
  conicCss: string;
  /** CSS linear swatch (left=0°, right=360°) */
  swatchCss: string;
};

// Twilight variants — 16 stops sampled over [0, 1) with phase offset
// Precomputed from matplotlib.cm.get_cmap('twilight')
const TWILIGHT_STOPS: [number, number, number][] = [
  [226,217,226],[196,206,212],[149,181,199],[114,151,193],[98,118,186],[94,81,173],
  [89,42,143],[69,19,92],[47,20,54],[74,19,66],[116,30,79],[152,53,80],
  [178,86,82],[194,124,99],[204,163,137],[216,199,190],
];
const TWILIGHT_90_STOPS: [number, number, number][] = [
  [98,118,186],[94,81,173],[89,42,143],[69,19,92],[47,20,54],[74,19,66],
  [116,30,79],[152,53,80],[178,86,82],[194,124,99],[204,163,137],[216,199,190],
  [226,217,226],[196,206,212],[149,181,199],[114,151,193],
];
const TWILIGHT_180_STOPS: [number, number, number][] = [
  [47,20,54],[74,19,66],[116,30,79],[152,53,80],[178,86,82],[194,124,99],
  [204,163,137],[216,199,190],[226,217,226],[196,206,212],[149,181,199],[114,151,193],
  [98,118,186],[94,81,173],[89,42,143],[69,19,92],
];
const TWILIGHT_270_STOPS: [number, number, number][] = [
  [178,86,82],[194,124,99],[204,163,137],[216,199,190],[226,217,226],[196,206,212],
  [149,181,199],[114,151,193],[98,118,186],[94,81,173],[89,42,143],[69,19,92],
  [47,20,54],[74,19,66],[116,30,79],[152,53,80],
];

function makeConicCss(stops: [number, number, number][]): string {
  const n = stops.length;
  const parts = stops.map((s, i) => `rgb(${s[0]},${s[1]},${s[2]}) ${Math.round((i / n) * 360)}deg`);
  const first = stops[0];
  parts.push(`rgb(${first[0]},${first[1]},${first[2]}) 360deg`);
  return `conic-gradient(from 0deg, ${parts.join(', ')})`;
}

function makeCircularSwatchCss(stops: [number, number, number][]): string {
  const parts = [...stops, stops[0]].map((s) => `rgb(${s[0]},${s[1]},${s[2]})`);
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

export const CIRCULAR_COLORMAPS: Record<CircularColormapId, CircularColormapDef> = {
  twilight:     { id: 'twilight',     label: 'Twilight',                stops: TWILIGHT_STOPS,    conicCss: makeConicCss(TWILIGHT_STOPS),    swatchCss: makeCircularSwatchCss(TWILIGHT_STOPS) },
  twilight_90:  { id: 'twilight_90',  label: 'Twilight, 90° offset',    stops: TWILIGHT_90_STOPS, conicCss: makeConicCss(TWILIGHT_90_STOPS), swatchCss: makeCircularSwatchCss(TWILIGHT_90_STOPS) },
  twilight_180: { id: 'twilight_180', label: 'Twilight, 180° offset',   stops: TWILIGHT_180_STOPS,conicCss: makeConicCss(TWILIGHT_180_STOPS),swatchCss: makeCircularSwatchCss(TWILIGHT_180_STOPS) },
  twilight_270: { id: 'twilight_270', label: 'Twilight, 270° offset',   stops: TWILIGHT_270_STOPS,conicCss: makeConicCss(TWILIGHT_270_STOPS),swatchCss: makeCircularSwatchCss(TWILIGHT_270_STOPS) },
};

export const CIRCULAR_COLORMAP_ORDER: CircularColormapId[] = ['twilight', 'twilight_90', 'twilight_180', 'twilight_270'];

export const DEFAULT_CIRCULAR_COLORMAP: CircularColormapId = 'twilight_90';

export const ASPECT_CONIC_CSS = CIRCULAR_COLORMAPS.twilight_90.conicCss;
export const ASPECT_NATIVE_COLOR = `rgb(${TWILIGHT_90_STOPS[Math.floor(TWILIGHT_90_STOPS.length / 4)].join(',')})`;
