// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createShadows, __shadowTestHooks, parseShadowValueWithResolvers, splitShadowLayersWithResolver } from '@/constants/shadows';

describe('shadows helper', () => {
  it('builds drop shadow tokens from wds style tokens', () => {
    const tokens = __shadowTestHooks?.buildDropShadowTokens();
    expect(Object.keys(tokens!).sort()).toEqual([
      'wds-effects-shadows-drop-shadow-100',
      'wds-effects-shadows-drop-shadow-200',
      'wds-effects-shadows-drop-shadow-300',
      'wds-effects-shadows-drop-shadow-400',
      'wds-effects-shadows-drop-shadow-500',
      'wds-effects-shadows-drop-shadow-600',
    ]);
  });

  it('parses shadow values with built-in resolvers', () => {
    const layers = parseShadowValueWithResolvers('0px 2px 4px rgba(0,0,0,0.5)');
    expect(layers[0]).toMatchObject({ offsetY: 2, blurRadius: 4 });
  });

  it('splits layers with built-in resolvers', () => {
    const layers = splitShadowLayersWithResolver('0 1px 2px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.3)');
    expect(layers).toHaveLength(2);
  });

  it('creates React Native shadow objects for all drop shadows', () => {
    const shadows = createShadows();
    expect(Object.keys(shadows).sort()).toEqual([
      'dropShadow100',
      'dropShadow200',
      'dropShadow300',
      'dropShadow400',
      'dropShadow500',
      'dropShadow600',
    ]);
    expect(shadows.dropShadow100.style.boxShadow).toBeDefined();
  });
});
