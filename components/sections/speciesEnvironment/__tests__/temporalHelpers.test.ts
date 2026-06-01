import {
  formatWindowHours,
  isTemporalId,
  parseTemporalId,
  stripTemporalSuffix,
} from '../temporalHelpers';

describe('temporalHelpers', () => {
  describe('parseTemporalId', () => {
    it('parses avg temporal id', () => {
      expect(parseTemporalId('cloud_cover_avg_168h')).toEqual({
        baseId: 'cloud_cover',
        agg: 'avg',
        windowHours: 168,
      });
    });

    it('parses mode temporal id', () => {
      expect(parseTemporalId('weather_code_simple_mode_24h')).toEqual({
        baseId: 'weather_code_simple',
        agg: 'mode',
        windowHours: 24,
      });
    });

    it('parses sum and snapshot aggregations', () => {
      expect(parseTemporalId('precip_sum_72h')?.agg).toBe('sum');
      expect(parseTemporalId('temp_snapshot_1h')?.agg).toBe('snapshot');
    });

    it('returns null for non-temporal ids', () => {
      expect(parseTemporalId('bio_1')).toBeNull();
      expect(parseTemporalId('elevation')).toBeNull();
      expect(parseTemporalId('')).toBeNull();
    });
  });

  describe('isTemporalId', () => {
    it('returns true for temporal ids', () => {
      expect(isTemporalId('cloud_cover_avg_168h')).toBe(true);
      expect(isTemporalId('temp_sum_8h')).toBe(true);
    });

    it('returns false for non-temporal ids', () => {
      expect(isTemporalId('bio_1')).toBe(false);
      expect(isTemporalId('landcover')).toBe(false);
    });
  });

  describe('stripTemporalSuffix', () => {
    it('strips avg suffix', () => {
      expect(stripTemporalSuffix('Dew Point (2m) (Avg, 168h)')).toBe(
        'Dew Point (2m)',
      );
    });

    it('strips mode suffix', () => {
      expect(stripTemporalSuffix('Weather Code (Mode, 24h)')).toBe(
        'Weather Code',
      );
    });

    it('leaves non-temporal labels unchanged', () => {
      expect(stripTemporalSuffix('Annual Mean Temperature')).toBe(
        'Annual Mean Temperature',
      );
    });
  });

  describe('formatWindowHours', () => {
    it('formats known window sizes', () => {
      expect(formatWindowHours(1)).toBe('1 hour');
      expect(formatWindowHours(8)).toBe('8 hours');
      expect(formatWindowHours(24)).toBe('1 day');
      expect(formatWindowHours(72)).toBe('3 days');
      expect(formatWindowHours(168)).toBe('1 week');
      expect(formatWindowHours(720)).toBe('1 month');
      expect(formatWindowHours(2160)).toBe('3 months');
    });

    it('falls back to raw hours for unknown sizes', () => {
      expect(formatWindowHours(48)).toBe('48h');
      expect(formatWindowHours(999)).toBe('999h');
    });
  });
});
