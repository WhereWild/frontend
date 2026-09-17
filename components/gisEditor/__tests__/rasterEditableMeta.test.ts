// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import type { DetectedValueType } from '../dataTypeDetection';
import {
  addDiscoveredClasses,
  buildInitialEditableMeta,
  editableMetaToDetectedType,
  toEnvironmentVariableOption,
  withScaleOffset,
  withValueType,
  type RasterEditableMeta,
} from '../rasterEditableMeta';

const nominalDetected: DetectedValueType = {
  guess: 'nominal',
  confidence: 'medium',
  reason: 'test',
  distinctCount: 3,
  distinctValues: [11, 21, 41],
};

const ratioDetected: DetectedValueType = {
  guess: 'ratio',
  confidence: 'low',
  reason: 'test',
  distinctCount: null,
  distinctValues: null,
};

describe('buildInitialEditableMeta', () => {
  it('seeds valueType and render bounds from the detection + sampled bounds', () => {
    const meta = buildInitialEditableMeta(ratioDetected, {
      min: 1,
      max: 100,
      approximate: false,
    });
    expect(meta.valueType).toBe('ratio');
    expect(meta.renderMin).toBe(1);
    expect(meta.renderMax).toBe(100);
    expect(meta.classes).toEqual([]);
  });

  it('defaults to ratio when there is no detection at all', () => {
    const meta = buildInitialEditableMeta(null, {
      min: 0,
      max: 1,
      approximate: true,
    });
    expect(meta.valueType).toBe('ratio');
  });

  it('seeds one named class with a color per distinct nominal value', () => {
    const meta = buildInitialEditableMeta(nominalDetected, {
      min: 11,
      max: 41,
      approximate: false,
    });
    expect(meta.valueType).toBe('nominal');
    expect(meta.classes.map((c) => c.value)).toEqual([11, 21, 41]);
    expect(meta.classes.every((c) => c.name === String(c.value))).toBe(true);
    expect(meta.classes.every((c) => typeof c.color === 'string')).toBe(true);
  });

  it('defaults circular render bounds to 0-360 regardless of sampled bounds', () => {
    const circularDetected: DetectedValueType = {
      guess: 'circular',
      confidence: 'medium',
      reason: 'test',
      distinctCount: null,
      distinctValues: null,
    };
    const meta = buildInitialEditableMeta(circularDetected, {
      min: 12,
      max: 350,
      approximate: false,
    });
    expect(meta.renderMin).toBe(0);
    expect(meta.renderMax).toBe(360);
  });

  it('applies detected scale/offset to the render bounds for ratio/interval', () => {
    const meta = buildInitialEditableMeta(
      ratioDetected,
      { min: 0, max: 1000, approximate: false },
      0.1,
      -50,
    );
    expect(meta.scale).toBe(0.1);
    expect(meta.offset).toBe(-50);
    expect(meta.renderMin).toBeCloseTo(-50);
    expect(meta.renderMax).toBeCloseTo(50);
  });

  it('does not apply scale/offset to circular or categorical bounds', () => {
    const circular = buildInitialEditableMeta(
      {
        guess: 'circular',
        confidence: 'medium',
        reason: 'test',
        distinctCount: null,
        distinctValues: null,
      },
      { min: 0, max: 1000, approximate: false },
      0.1,
      -50,
    );
    expect(circular.renderMin).toBe(0);
    expect(circular.renderMax).toBe(360);

    const nominal = buildInitialEditableMeta(
      nominalDetected,
      { min: 11, max: 41, approximate: false },
      0.1,
      -50,
    );
    expect(nominal.renderMin).toBe(11);
    expect(nominal.renderMax).toBe(41);
  });

  it('defaults scale/offset to 1/0 when the file has none', () => {
    const meta = buildInitialEditableMeta(ratioDetected, {
      min: 1,
      max: 100,
      approximate: false,
    });
    expect(meta.scale).toBe(1);
    expect(meta.offset).toBe(0);
  });

  it('seeds units from the detected GDAL UnitType', () => {
    const meta = buildInitialEditableMeta(
      ratioDetected,
      { min: 0, max: 1, approximate: false },
      null,
      null,
      '°C',
    );
    expect(meta.units).toBe('°C');
  });

  it('uses the exact saved class names/colors when re-opening a saved file, instead of generated defaults', () => {
    const meta = buildInitialEditableMeta(
      nominalDetected,
      { min: 11, max: 41, approximate: false },
      null,
      null,
      null,
      [
        { id: 21, name: 'Forest', color: '#00ff00' },
        { id: 11, name: 'Water', color: '#0000ff' },
      ],
    );
    // Sorted by id, and using the real saved names — not "String(value)".
    expect(meta.classes).toEqual([
      { value: 11, name: 'Water', color: '#0000ff' },
      { value: 21, name: 'Forest', color: '#00ff00' },
    ]);
  });
});

describe('withScaleOffset', () => {
  it('re-derives render bounds from the raw bounds under the new scale/offset', () => {
    const editable: RasterEditableMeta = {
      valueType: 'ratio',
      units: '',
      renderMin: 0,
      renderMax: 1000,
      scale: 1,
      offset: 0,
      classes: [],
    };
    const next = withScaleOffset(
      editable,
      { min: 0, max: 1000, approximate: false },
      0.1,
      -50,
    );
    expect(next.scale).toBe(0.1);
    expect(next.offset).toBe(-50);
    expect(next.renderMin).toBeCloseTo(-50);
    expect(next.renderMax).toBeCloseTo(50);
  });
});

describe('withValueType', () => {
  const base: RasterEditableMeta = {
    valueType: 'ratio',
    units: '',
    renderMin: 0,
    renderMax: 10,
    scale: 1,
    offset: 0,
    classes: [],
  };

  it('is a no-op when the type is unchanged', () => {
    expect(withValueType(base, 'ratio', ratioDetected)).toBe(base);
  });

  it('populates classes from detected distinct values when switching to nominal', () => {
    const next = withValueType(base, 'nominal', nominalDetected);
    expect(next.classes.map((c) => c.value)).toEqual([11, 21, 41]);
    expect(next.classes.every((c) => c.color)).toBe(true);
  });

  it('drops colors when switching from nominal to ordinal keeps ranking colors instead', () => {
    const nominal = withValueType(base, 'nominal', nominalDetected);
    const ordinal = withValueType(nominal, 'ordinal', nominalDetected);
    // Names survive the switch, colors get re-derived (still set, just via
    // the ordinal rank palette rather than the nominal hue palette).
    expect(ordinal.classes.map((c) => c.value)).toEqual(
      nominal.classes.map((c) => c.value),
    );
    expect(ordinal.classes.every((c) => c.color)).toBe(true);
  });

  it('resets render bounds to the circular default when switching to circular', () => {
    const next = withValueType(base, 'circular', ratioDetected);
    expect(next.renderMin).toBe(0);
    expect(next.renderMax).toBe(360);
  });
});

describe('toEnvironmentVariableOption', () => {
  it('maps editable state to EnvironmentVariableOption fields', () => {
    const editable: RasterEditableMeta = {
      valueType: 'nominal',
      units: '  mm ',
      renderMin: 0,
      renderMax: 1,
      scale: 1,
      offset: 0,
      classes: [{ value: 11, name: 'Forest', color: '#00ff00' }],
    };
    const option = toEnvironmentVariableOption('test.tif', 3, editable);
    expect(option.valueType).toBe('nominal');
    expect(option.units).toBe('mm');
    expect(option.version).toBe(3);
    expect(option.legendClasses).toEqual([
      { id: 11, name: 'Forest', color: '#00ff00' },
    ]);
  });

  it('nulls out units and legendClasses when empty', () => {
    const editable: RasterEditableMeta = {
      valueType: 'ratio',
      units: '   ',
      renderMin: 0,
      renderMax: 1,
      scale: 1,
      offset: 0,
      classes: [],
    };
    const option = toEnvironmentVariableOption('test.tif', 1, editable);
    expect(option.units).toBeNull();
    expect(option.legendClasses).toBeNull();
  });
});

describe('editableMetaToDetectedType', () => {
  it('reflects the manually chosen type with high confidence', () => {
    const editable: RasterEditableMeta = {
      valueType: 'circular',
      units: '',
      renderMin: 0,
      renderMax: 360,
      scale: 1,
      offset: 0,
      classes: [],
    };
    const detected = editableMetaToDetectedType(editable);
    expect(detected.guess).toBe('circular');
    expect(detected.confidence).toBe('high');
  });
});

describe('addDiscoveredClasses', () => {
  const ordinal: RasterEditableMeta = {
    valueType: 'ordinal',
    units: '',
    renderMin: 0,
    renderMax: 4,
    scale: 1,
    offset: 0,
    classes: [
      { value: 0, name: '0', color: '#111111' },
      { value: 1, name: '1', color: '#222222' },
      { value: 2, name: '2', color: '#333333' },
      { value: 4, name: '4', color: '#444444' },
    ],
  };

  it('inserts a class actually seen while rendering, in sorted order', () => {
    const result = addDiscoveredClasses(ordinal, [3]);
    expect(result.classes.map((c) => c.value)).toEqual([0, 1, 2, 3, 4]);
    const added = result.classes.find((c) => c.value === 3);
    expect(added?.name).toBe('3');
    expect(added?.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('leaves every existing class untouched, including its color', () => {
    const result = addDiscoveredClasses(ordinal, [3]);
    for (const original of ordinal.classes) {
      const kept = result.classes.find((c) => c.value === original.value);
      expect(kept).toEqual(original);
    }
  });

  it('is a no-op for an id that is already known', () => {
    const result = addDiscoveredClasses(ordinal, [2]);
    expect(result).toBe(ordinal);
  });

  it('is a no-op for continuous data (nothing to grow)', () => {
    const ratio: RasterEditableMeta = {
      valueType: 'ratio',
      units: '',
      renderMin: 0,
      renderMax: 100,
      scale: 1,
      offset: 0,
      classes: [],
    };
    expect(addDiscoveredClasses(ratio, [5])).toBe(ratio);
  });

  it('dedupes repeated ids in a single call', () => {
    const result = addDiscoveredClasses(ordinal, [3, 3, 3]);
    expect(result.classes.filter((c) => c.value === 3)).toHaveLength(1);
  });
});
