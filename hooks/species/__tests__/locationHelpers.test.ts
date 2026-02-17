import {
  compareLocationsByName,
  getValidLocationGid,
  mapLocationsToOptions,
  toSanitizedLocation,
} from '@/hooks/species/locationHelpers';

describe('locationHelpers', () => {
  it('returns trimmed gid when valid and null when blank', () => {
    expect(getValidLocationGid({ gid: '  country-us  ', name: 'United States', level: 0, hierarchy: [] })).toBe('country-us');
    expect(getValidLocationGid({ gid: '   ', name: 'Missing', level: 0, hierarchy: [] } as any)).toBeNull();
  });

  it('sanitizes location name with gid fallback', () => {
    expect(
      toSanitizedLocation({ gid: 'country-us', name: '  United States  ', level: 0, hierarchy: [] }),
    ).toEqual({ gid: 'country-us', name: 'United States', level: 0, hierarchy: [] });

    expect(
      toSanitizedLocation({ gid: 'country-us', name: '   ', level: 0, hierarchy: [] } as any),
    ).toEqual({ gid: 'country-us', name: 'country-us', level: 0, hierarchy: [] });

    expect(
      toSanitizedLocation({ gid: '', name: 'Invalid', level: 0, hierarchy: [] } as any),
    ).toBeNull();
  });

  it('maps locations to options and skips invalid gid rows', () => {
    const { sanitized, options } = mapLocationsToOptions([
      { gid: 'country-us', name: 'United States', level: 0, hierarchy: [] },
      { gid: ' ', name: 'Missing gid', level: 0, hierarchy: [] } as any,
      { gid: 'country-mx', name: ' ', level: 0, hierarchy: [] } as any,
    ]);

    const sanitizedNames = sanitized.map((row) => row.name);
    const optionLabels = options.map((option) => option.label);

    expect(sanitized).toEqual([
      { gid: 'country-us', name: 'United States', level: 0, hierarchy: [] },
      { gid: 'country-mx', name: 'country-mx', level: 0, hierarchy: [] },
    ]);

    expect(options).toEqual([
      { label: 'United States', value: 'country-us' },
      { label: 'country-mx', value: 'country-mx' },
    ]);

    expect(sanitizedNames).not.toContain('Missing gid');
    expect(optionLabels).not.toContain('Missing gid');
  });

  it('sorts locations by safe string name', () => {
    const rows = [
      { gid: 'b', name: 'Beta', level: 0, hierarchy: [] },
      { gid: 'a', name: undefined, level: 0, hierarchy: [] } as any,
      { gid: 'c', name: 'Alpha', level: 0, hierarchy: [] },
    ];

    rows.sort(compareLocationsByName);

    expect(rows.map((row) => row.gid)).toEqual(['a', 'c', 'b']);
  });
});
