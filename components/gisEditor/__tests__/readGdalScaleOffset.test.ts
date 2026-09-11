// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import { readGdalScaleOffset } from '../rasterMetadata';

describe('readGdalScaleOffset', () => {
  it('returns nulls when there is no GDAL metadata', () => {
    expect(readGdalScaleOffset(null)).toEqual({ scale: null, offset: null });
    expect(readGdalScaleOffset(undefined)).toEqual({
      scale: null,
      offset: null,
    });
  });

  it('reads Scale/Offset regardless of key casing', () => {
    expect(readGdalScaleOffset({ Scale: '0.1', Offset: '-273.15' })).toEqual({
      scale: 0.1,
      offset: -273.15,
    });
    expect(readGdalScaleOffset({ SCALE: '2', OFFSET: '0' })).toEqual({
      scale: 2,
      offset: 0,
    });
  });

  it('ignores unrelated or malformed items', () => {
    expect(
      readGdalScaleOffset({ AREA_OR_POINT: 'Area', Scale: 'not-a-number' }),
    ).toEqual({ scale: null, offset: null });
  });
});
