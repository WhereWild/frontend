// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  interpolateAspectStops,
  interpolateGradientStops,
  resolveObservationVarFields,
  safeGradientT,
  type ObservationVarFieldsInputs,
} from '../speciesOccurrenceMap/speciesOccurrenceMapHelpers';

const baseInputs: ObservationVarFieldsInputs = {
  observationValues: null,
  classColors: null,
  classLabels: null,
  isCircular: false,
  dotMin: null,
  dotMax: null,
  gradientStops: null,
  aspectStops: null,
  varUnits: null,
};

describe('safeGradientT', () => {
  it('clamps to [0, 1] and interpolates linearly between lo and hi', () => {
    expect(safeGradientT(5, 0, 10)).toBe(0.5);
    expect(safeGradientT(-5, 0, 10)).toBe(0);
    expect(safeGradientT(15, 0, 10)).toBe(1);
  });

  it('returns 0 when lo is not less than hi, mirroring the map HTML fallback', () => {
    expect(safeGradientT(5, 10, 10)).toBe(0);
    expect(safeGradientT(5, 10, 0)).toBe(0);
  });
});

describe('interpolateGradientStops', () => {
  const stops: [number, number, number][] = [
    [0, 0, 0],
    [128, 128, 128],
    [255, 255, 255],
  ];

  it('returns the first stop at t=0 and the last stop at t=1', () => {
    expect(interpolateGradientStops(0, stops)).toBe('rgb(0,0,0)');
    expect(interpolateGradientStops(1, stops)).toBe('rgb(255,255,255)');
  });

  it('interpolates within the first segment', () => {
    // 3 stops = 2 segments; t=0.25 falls halfway through the first
    // segment ([0,0,0] -> [128,128,128]), not a third of the way through
    // the whole range.
    expect(interpolateGradientStops(0.25, stops)).toBe('rgb(64,64,64)');
  });
});

describe('interpolateAspectStops', () => {
  // Same 4-stop N/E/S/W table shape used by CIRCULAR_COLORMAPS.
  const stops: [number, number, number][] = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
  ];

  it('wraps negative and >360 degrees the same as 0-360', () => {
    expect(interpolateAspectStops(0, stops)).toBe(
      interpolateAspectStops(360, stops),
    );
    expect(interpolateAspectStops(-10, stops)).toBe(
      interpolateAspectStops(350, stops),
    );
  });

  it('returns the exact stop color at each stop boundary', () => {
    expect(interpolateAspectStops(0, stops)).toBe('rgb(255,0,0)');
    expect(interpolateAspectStops(90, stops)).toBe('rgb(0,255,0)');
    expect(interpolateAspectStops(180, stops)).toBe('rgb(0,0,255)');
    expect(interpolateAspectStops(270, stops)).toBe('rgb(255,255,0)');
  });
});

describe('resolveObservationVarFields', () => {
  it('returns all-null fields when the catalog has no observation value', () => {
    const result = resolveObservationVarFields('123', {
      ...baseInputs,
      observationValues: new Map(),
    });
    expect(result).toEqual({
      varValue: null,
      varColor: null,
      varLabel: null,
      varShape: null,
    });
  });

  it('resolves categorical color/label from classColors/classLabels, matching the map popup class-key rounding', () => {
    const result = resolveObservationVarFields('123', {
      ...baseInputs,
      observationValues: new Map([['123', 2.4]]),
      classColors: new Map([['2', '#abcdef']]),
      classLabels: new Map([['2', 'Loam']]),
    });
    expect(result).toEqual({
      varValue: 2.4,
      varColor: '#abcdef',
      varLabel: 'Loam',
      varShape: null,
    });
  });

  it('resolves a per-class shape from classShapes when shapes mode is on for a nominal variable', () => {
    const result = resolveObservationVarFields('123', {
      ...baseInputs,
      observationValues: new Map([['123', 2.4]]),
      classColors: new Map([['2', '#abcdef']]),
      classLabels: new Map([['2', 'Loam']]),
      classShapes: new Map([['2', 'triangle']]),
    });
    expect(result.varShape).toBe('triangle');
  });

  it('falls back to the circular cardinal-direction shape when circularShapesEnabled is set and there is no classShapes entry', () => {
    const aspectStops: [number, number, number][] = [
      [255, 0, 0],
      [0, 255, 0],
    ];
    const result = resolveObservationVarFields('123', {
      ...baseInputs,
      observationValues: new Map([['123', 90]]),
      isCircular: true,
      aspectStops,
      circularShapesEnabled: true,
    });
    // 90deg falls in the "E" quadrant of aspectToCardinalShape's N/E/S/W table.
    expect(result.varShape).toBe('arrow');
  });

  it('returns a null shape when neither classShapes nor circularShapesEnabled apply', () => {
    const result = resolveObservationVarFields('123', {
      ...baseInputs,
      observationValues: new Map([['123', 2.4]]),
      classColors: new Map([['2', '#abcdef']]),
    });
    expect(result.varShape).toBeNull();
  });

  it('resolves a circular value using aspectStops and formats it with a degree symbol', () => {
    const aspectStops: [number, number, number][] = [
      [255, 0, 0],
      [0, 255, 0],
    ];
    const result = resolveObservationVarFields('123', {
      ...baseInputs,
      observationValues: new Map([['123', 90]]),
      isCircular: true,
      aspectStops,
    });
    expect(result.varValue).toBe(90);
    expect(result.varLabel).toBe('90°');
    expect(result.varColor).toBe(interpolateAspectStops(90, aspectStops));
  });

  it('resolves a continuous value using gradientStops/dotMin/dotMax and appends units', () => {
    const gradientStops: [number, number, number][] = [
      [0, 0, 0],
      [255, 255, 255],
    ];
    const result = resolveObservationVarFields('123', {
      ...baseInputs,
      observationValues: new Map([['123', 5]]),
      dotMin: 0,
      dotMax: 10,
      gradientStops,
      varUnits: '°C',
    });
    expect(result.varValue).toBe(5);
    expect(result.varLabel).toBe('5 °C');
    expect(result.varColor).toBe(
      interpolateGradientStops(safeGradientT(5, 0, 10), gradientStops),
    );
  });

  it('formats large continuous values with no decimals, matching buildObservationValueHtml', () => {
    const gradientStops: [number, number, number][] = [
      [0, 0, 0],
      [255, 255, 255],
    ];
    const result = resolveObservationVarFields('123', {
      ...baseInputs,
      observationValues: new Map([['123', 12345.678]]),
      dotMin: 0,
      dotMax: 20000,
      gradientStops,
    });
    expect(result.varLabel).toBe('12,346');
  });

  it('returns a null color for continuous values missing dotMin/dotMax/gradientStops', () => {
    const result = resolveObservationVarFields('123', {
      ...baseInputs,
      observationValues: new Map([['123', 5]]),
    });
    expect(result.varValue).toBe(5);
    expect(result.varColor).toBeNull();
  });
});
