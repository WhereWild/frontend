// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Default swatch colors for legend classes in the metadata editor.
//
// Nominal classes are unordered, so evenly spaced hues around the color
// wheel keep adjacent classes visually distinct regardless of how many
// there are — and since order carries no meaning, the user is free to
// repaint them however they like.
//
// Ordinal classes rank-order the data, so the default instead samples a
// sequential colormap by rank (the same idea as the continuous legend) —
// the editor doesn't expose a color picker for these (see
// rasterEditableMeta.ts / MetadataEditor.tsx), they're map-rendering
// defaults only.

import { buildColorLut } from './cogTileMath';
import { COLORMAPS } from '@/components/sections/speciesOccurrenceMap/variableColors';

const hslToHex = (h: number, s: number, l: number): string => {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
};

export const defaultClassColor = (index: number, total: number): string => {
  const hue = total > 0 ? (index * 360) / total : 0;
  return hslToHex(hue, 65, 50);
};

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

let ordinalLut: Uint8Array | null = null;

export const defaultOrdinalColor = (index: number, total: number): string => {
  if (!ordinalLut) ordinalLut = buildColorLut(COLORMAPS.viridis.stops);
  const t = total > 1 ? index / (total - 1) : 0;
  const idx = Math.round(t * 255) * 3;
  return rgbToHex(ordinalLut[idx], ordinalLut[idx + 1], ordinalLut[idx + 2]);
};
