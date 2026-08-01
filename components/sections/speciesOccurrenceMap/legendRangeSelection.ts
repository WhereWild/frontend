// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/** A selected [min, max] range on a map legend, sent to the tile endpoint as
 * value_min/value_max. For the circular legend these are a start/end angle
 * in degrees rather than a sorted numeric range — see MapCircularLegend. */
export type LegendRange = { min: number; max: number };
