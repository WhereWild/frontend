// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import { readGdalUnitType, readWherewildConfig } from '../rasterMetadata';

describe('readGdalUnitType', () => {
  it('returns null when there is no GDAL metadata or no UnitType item', () => {
    expect(readGdalUnitType(null)).toBeNull();
    expect(readGdalUnitType({ Scale: '1' })).toBeNull();
  });

  it('reads UnitType regardless of key casing', () => {
    expect(readGdalUnitType({ UnitType: 'mm' })).toBe('mm');
    expect(readGdalUnitType({ UNITTYPE: '°C' })).toBe('°C');
  });

  it('ignores a blank UnitType', () => {
    expect(readGdalUnitType({ UnitType: '   ' })).toBeNull();
  });
});

describe('readWherewildConfig', () => {
  it('returns null when there is no saved WHEREWILD_VALUE_TYPE item', () => {
    expect(readWherewildConfig(null)).toBeNull();
    expect(readWherewildConfig({ Scale: '1' })).toBeNull();
  });

  it('returns null for an unrecognized value type (foreign/corrupt data)', () => {
    expect(
      readWherewildConfig({ WHEREWILD_VALUE_TYPE: 'not-a-real-type' }),
    ).toBeNull();
  });

  it('reads a saved value type with no legend', () => {
    expect(readWherewildConfig({ WHEREWILD_VALUE_TYPE: 'ratio' })).toEqual({
      valueType: 'ratio',
      classes: [],
      displayName: null,
    });
  });

  it('reads a saved value type with a legend', () => {
    const legend = JSON.stringify([
      { id: 11, name: 'Water', color: '#0000ff' },
      { id: 21, name: 'Forest', color: null },
    ]);
    expect(
      readWherewildConfig({
        WHEREWILD_VALUE_TYPE: 'nominal',
        WHEREWILD_LEGEND: legend,
      }),
    ).toEqual({
      valueType: 'nominal',
      classes: [
        { id: 11, name: 'Water', color: '#0000ff' },
        { id: 21, name: 'Forest', color: null },
      ],
      displayName: null,
    });
  });

  it('falls back to an empty legend for malformed JSON instead of throwing', () => {
    expect(
      readWherewildConfig({
        WHEREWILD_VALUE_TYPE: 'ordinal',
        WHEREWILD_LEGEND: '{not valid json',
      }),
    ).toEqual({ valueType: 'ordinal', classes: [], displayName: null });
  });

  it('reads a legend written by real GDAL (rasterio update_tags), which double-escapes XML entities unlike this tool’s own writer', () => {
    // Confirmed directly against a real GDAL-written file while building
    // scripts/gis/prop_metadata.py in the backend repo: GDAL's own
    // SetMetadataItem/update_tags path escapes an Item's text TWICE (its
    // own reader silently undoes both passes, so this is invisible to
    // anything that reads the file back through GDAL/rasterio itself) --
    // e.g. a literal '&' round-trips to "&amp;amp;" on disk, not
    // "&amp;". geotiff.js does zero unescaping on read, so this tool has
    // to undo however many passes were actually applied.
    const xmlEscapeOnce = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const json = JSON.stringify([
      { id: 1, name: 'Salt & Pepper "flats"', color: '#abcdef' },
    ]);
    const doubleEscaped = xmlEscapeOnce(xmlEscapeOnce(json));
    expect(doubleEscaped).toContain('&amp;quot;');
    expect(
      readWherewildConfig({
        WHEREWILD_VALUE_TYPE: 'nominal',
        WHEREWILD_LEGEND: doubleEscaped,
      }),
    ).toEqual({
      valueType: 'nominal',
      classes: [{ id: 1, name: 'Salt & Pepper "flats"', color: '#abcdef' }],
      displayName: null,
    });
  });

  it('drops legend entries missing a numeric id or string name', () => {
    const legend = JSON.stringify([
      { id: 1, name: 'Ok', color: null },
      { id: 'not-a-number', name: 'Bad id' },
      { name: 'Missing id' },
      { id: 2 },
    ]);
    expect(
      readWherewildConfig({
        WHEREWILD_VALUE_TYPE: 'nominal',
        WHEREWILD_LEGEND: legend,
      }),
    ).toEqual({
      valueType: 'nominal',
      classes: [{ id: 1, name: 'Ok', color: null }],
      displayName: null,
    });
  });

  it('reads a saved display name, unescaping entities and trimming it', () => {
    expect(
      readWherewildConfig({
        WHEREWILD_VALUE_TYPE: 'ratio',
        WHEREWILD_NAME: '  Salt &amp; Pepper  ',
      })?.displayName,
    ).toBe('Salt & Pepper');
  });

  it('treats a blank saved display name as none', () => {
    expect(
      readWherewildConfig({
        WHEREWILD_VALUE_TYPE: 'ratio',
        WHEREWILD_NAME: '   ',
      })?.displayName,
    ).toBeNull();
  });
});
