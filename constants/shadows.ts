// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cssLengthToPx, resolveCssVariables } from './tokenHelpers';
import { buildShadows, dropShadowTokenNames, parseShadowValue, splitShadowLayers } from './shadowUtils';
import type { ShadowStyleTokens } from './shadowUtils';
import { wdsStyleTokens } from './wdsTokens';

const buildDropShadowTokens = () =>
  dropShadowTokenNames.reduce((acc, tokenName) => {
    acc[tokenName] = wdsStyleTokens[tokenName];
    return acc;
  }, {} as ShadowStyleTokens);

export const createShadows = () => buildShadows(buildDropShadowTokens(), resolveCssVariables, cssLengthToPx);

const isTestEnv = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

// Test-only export for shadow internals (see theme.ts for pattern)
// Runtime builds receive undefined so the helpers stay hidden.
export const __shadowTestHooks = isTestEnv
  ? {
      buildDropShadowTokens,
    }
  : undefined;

// Convenience re-exports so consumers don’t have to import from shadowUtils directly.
export const splitShadowLayersWithResolver = (value: string) => splitShadowLayers(value, resolveCssVariables);

export const parseShadowValueWithResolvers = (value: string) =>
  parseShadowValue(value, resolveCssVariables, cssLengthToPx);
