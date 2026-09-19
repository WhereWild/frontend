// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import { buildCogFixCommand } from '../cogFixCommand';
import type { DetectedValueType } from '../dataTypeDetection';
import type { RasterMetadata } from '../rasterMetadata';

const baseMetadata = { noData: -9999 } as unknown as RasterMetadata;

const detected = (
  guess: DetectedValueType['guess'],
  confidence: DetectedValueType['confidence'] = 'medium',
): DetectedValueType => ({
  guess,
  confidence,
  reason: 'test',
  distinctCount: null,
});

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

  it('defaults to AVERAGE with a caveat note when no verdict is available', () => {
    const cmd = buildCogFixCommand('huge.tif', baseMetadata, null);
    expect(cmd).toContain('-co RESAMPLING=AVERAGE');
    expect(cmd).toMatch(/couldn't guess a data type/);
  });

  it('uses MODE for nominal data', () => {
    const cmd = buildCogFixCommand(
      'huge.tif',
      baseMetadata,
      detected('nominal'),
    );
    expect(cmd).toContain('-co RESAMPLING=MODE');
    expect(cmd).toMatch(/detected as nominal/);
  });

  it('uses MODE for ordinal data', () => {
    const cmd = buildCogFixCommand(
      'huge.tif',
      baseMetadata,
      detected('ordinal'),
    );
    expect(cmd).toContain('-co RESAMPLING=MODE');
  });

  it('uses NEAREST for circular data, explaining why averaging angles is wrong', () => {
    const cmd = buildCogFixCommand(
      'huge.tif',
      baseMetadata,
      detected('circular'),
    );
    expect(cmd).toContain('-co RESAMPLING=NEAREST');
    expect(cmd).toMatch(/averaging angles directly is wrong/);
  });

  it('uses AVERAGE for ratio/interval data, flagging low-confidence guesses', () => {
    const confident = buildCogFixCommand(
      'huge.tif',
      baseMetadata,
      detected('ratio', 'low'),
    );
    expect(confident).toContain('-co RESAMPLING=AVERAGE');
    expect(confident).toMatch(/low-confidence guess/);

    const highConfidence = buildCogFixCommand(
      'huge.tif',
      baseMetadata,
      detected('interval', 'medium'),
    );
    expect(highConfidence).toContain('-co RESAMPLING=AVERAGE');
    expect(highConfidence).not.toMatch(/low-confidence guess/);
  });
});
