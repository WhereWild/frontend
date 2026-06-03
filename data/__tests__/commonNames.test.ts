// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildCommonNamesWithPrimary, dedupeCaseInsensitive, normalizeCommonNames } from '../commonNames';

describe('commonNames helpers', () => {
  it('dedupes names case-insensitively while keeping first-seen casing', () => {
    const result = dedupeCaseInsensitive(['Cougar', 'cougar', 'COUGAR', 'Mountain Lion']);

    expect(result).toEqual(['Cougar', 'Mountain Lion']);
  });

  it('normalizes raw common names by trimming, removing invalid values, and deduping', () => {
    const result = normalizeCommonNames([null, '  Wolf  ', '', 'Wolf', 'Gray Wolf']);

    expect(result).toEqual(['Wolf', 'Gray Wolf']);
  });

  it('dedupes normalized raw common names case-insensitively', () => {
    const result = normalizeCommonNames(['Cougar', 'cougar', '  COUGAR  ', 'Mountain Lion']);

    expect(result).toEqual(['Cougar', 'Mountain Lion']);
  });

  it('builds common names with primary first and case-insensitive dedupe', () => {
    const result = buildCommonNamesWithPrimary('Cougar', ['mountain lion', 'cougar', '  Cougar  ']);

    expect(result).toEqual(['Cougar', 'mountain lion']);
  });

  it('falls back to first alternate when primary is empty', () => {
    const result = buildCommonNamesWithPrimary('   ', [null, '  Wolf  ', 'Gray Wolf']);

    expect(result).toEqual(['Wolf', 'Gray Wolf']);
  });
});
