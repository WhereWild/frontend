// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import { buildCogFixCommand } from '../cogFixCommand';
import type { RasterMetadata } from '../rasterMetadata';

const baseMetadata = { noData: -9999 } as unknown as RasterMetadata;

describe('buildCogFixCommand', () => {
  it('builds a COG conversion command with the derived output filename', () => {
    const cmd = buildCogFixCommand('huge.tif', baseMetadata);
    expect(cmd).toContain('gdal_translate huge.tif huge_cog.tif');
    expect(cmd).toContain('-of COG');
    expect(cmd).toContain('-co COMPRESS=DEFLATE');
    expect(cmd).toContain('-co RESAMPLING=AVERAGE');
  });

  it('handles a .tiff extension', () => {
    expect(buildCogFixCommand('huge.tiff', baseMetadata)).toContain(
      'huge_cog.tif',
    );
  });

  it('suggests -a_nodata when the source has none set', () => {
    const withoutNoData = { noData: null } as unknown as RasterMetadata;
    expect(buildCogFixCommand('huge.tif', withoutNoData)).toContain(
      '-a_nodata',
    );
    expect(buildCogFixCommand('huge.tif', baseMetadata)).not.toContain(
      '-a_nodata',
    );
  });
});
