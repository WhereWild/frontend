// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import { deriveCogDiagnostics, type IfdSummary } from '../cogDiagnostics';

const tiled = (width: number, height: number, tile = 512): IfdSummary => ({
  width,
  height,
  tiled: true,
  tileWidth: tile,
  tileHeight: tile,
});

describe('deriveCogDiagnostics', () => {
  it('accepts a tiled image with ordered overviews', () => {
    const result = deriveCogDiagnostics([
      tiled(4096, 4096),
      tiled(2048, 2048),
      tiled(1024, 1024),
    ]);
    expect(result.isCog).toBe(true);
  });

  it('rejects a stripped image', () => {
    expect(
      deriveCogDiagnostics([{ width: 4096, height: 4096, tiled: false }]).isCog,
    ).toBe(false);
  });

  it('rejects a large tiled image with no overviews', () => {
    expect(deriveCogDiagnostics([tiled(4096, 4096)]).isCog).toBe(false);
  });

  it('accepts a small single-tile image with no overviews', () => {
    expect(deriveCogDiagnostics([tiled(400, 400, 512)]).isCog).toBe(true);
  });

  it('flags out-of-order overviews', () => {
    expect(
      deriveCogDiagnostics([
        tiled(4096, 4096),
        tiled(512, 512),
        tiled(2048, 2048),
      ]).isCog,
    ).toBe(false);
  });

  it('flags a non-power-of-two tile size', () => {
    expect(
      deriveCogDiagnostics([tiled(4096, 4096, 300), tiled(1024, 1024, 300)])
        .isCog,
    ).toBe(false);
  });
});
