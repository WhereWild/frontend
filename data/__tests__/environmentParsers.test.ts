import { parseSpeciesEnvironmentStats } from '../environmentParsers';

describe('parseSpeciesEnvironmentStats', () => {
  it('parses minimal all_obscured payloads from the backend fallback response', () => {
    const result = parseSpeciesEnvironmentStats(
      {
        all_obscured: true,
        speciesId: 42,
        variable: 'bio_1',
      },
      42,
      'bio_1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        speciesId: 42,
        variable: 'bio_1',
        variableName: 'bio_1',
        allObscured: true,
        observationCount: 0,
        summary: expect.objectContaining({ count: 0 }),
      }),
    );
  });

  it('parses camelCase allObscured and variable metadata fields', () => {
    const result = parseSpeciesEnvironmentStats(
      {
        allObscured: true,
        species_id: 7,
        variable: 'landcover',
        variable_metadata: {
          name: 'Land Cover',
          units: null,
          valueType: 'categorical',
        },
      },
      7,
      'landcover',
    );

    expect(result.allObscured).toBe(true);
    expect(result.speciesId).toBe(7);
    expect(result.variableName).toBe('Land Cover');
    expect(result.variableType).toBe('categorical');
  });
});
