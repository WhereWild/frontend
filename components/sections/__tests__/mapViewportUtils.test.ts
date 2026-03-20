import {
  alignLongitudeToView,
  canonicalizeRequestBounds,
  clampMaxCells,
  clampResolution,
  currentWorldLongitudeWindow,
  wrapLongitudeCanonical,
} from '../speciesOccurrenceMap/mapViewportUtils';

describe('mapViewportUtils', () => {
  it('canonicalizeRequestBounds falls back to full-world longitude when span crosses dateline', () => {
    const bounds = canonicalizeRequestBounds(-10, 170, 10, -170);

    expect(bounds.minLon).toBe(-180);
    expect(bounds.maxLon).toBe(180);
  });

  it('canonicalizeRequestBounds always returns strict increasing latitude and longitude ranges', () => {
    const bounds = canonicalizeRequestBounds(90, 45, 90, 45);

    expect(bounds.minLat).toBeLessThan(bounds.maxLat);
    expect(bounds.minLon).toBeLessThan(bounds.maxLon);
  });

  it('clampResolution enforces backend limits', () => {
    expect(clampResolution(-1, 0.25)).toBe(0.25);
    expect(clampResolution(0.5, 0.25)).toBe(0.5);
    expect(clampResolution(20, 0.25)).toBe(10);
  });

  it('clampMaxCells enforces backend limits', () => {
    expect(clampMaxCells(1, 20000)).toBe(100);
    expect(clampMaxCells(250000, 20000)).toBe(250000);
    expect(clampMaxCells(5000000, 20000)).toBe(2000000);
  });

  it('alignLongitudeToView aligns longitudes relative to view', () => {
    expect(alignLongitudeToView(-170, 190)).toBe(190);
  });

  it('wrapLongitudeCanonical wraps longitudes canonically', () => {
    expect(wrapLongitudeCanonical(190)).toBe(-170);
  });

  it('currentWorldLongitudeWindow returns the correct window for a given longitude', () => {
    expect(currentWorldLongitudeWindow(540)).toEqual({ west: 540, east: 900 });
  });
});