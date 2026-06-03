// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Size, Time } from '@/constants/theme';

/** Standard square slot width for icon-only actions in the top app bar. */
export const TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH = 40;

/** Rendered logo size in the leading home variant. */
export const TOP_APP_BAR_LOGO_SIZE = 40;

/** Duration used for search/non-search leading content transitions. */
export const TOP_APP_BAR_SEARCH_TRANSITION_DURATION = Time.duration.medium;

/** Duration used for primary action show/hide width+opacity transitions. */
export const TOP_APP_BAR_PRIMARY_ACTION_TRANSITION_DURATION =
  Time.duration.medium;

/** Horizontal slide offset used during search variant enter/exit animations. */
export const TOP_APP_BAR_SEARCH_SLIDE_OFFSET = Size.space['600'];
