// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import type { DetectedValueType } from '../dataTypeDetection';
import {
  buildInitialEditableMeta,
  editableMetaToDetectedType,
  toEnvironmentVariableOption,
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
});

describe('withValueType', () => {
  const base: RasterEditableMeta = {
    valueType: 'ratio',
    units: '',
    renderMin: 0,
    renderMax: 10,
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
      classes: [],
    };
    const detected = editableMetaToDetectedType(editable);
    expect(detected.guess).toBe('circular');
    expect(detected.confidence).toBe('high');
  });
});
