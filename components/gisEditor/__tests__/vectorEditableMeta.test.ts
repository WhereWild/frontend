// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import {
  buildInitialVectorEditableMeta,
  distinctFieldValues,
  withCategoricalField,
  withClassColor,
  withClassName,
  withSingleColor,
} from '../vectorEditableMeta';
import type { VectorField, VectorSavedConfig } from '../shapefileMetadata';

const fields: VectorField[] = [
  { name: 'LAND_USE', type: 'string', likelyCategorical: true },
];
const features = [
  { properties: { LAND_USE: 'Forest' } },
  { properties: { LAND_USE: 'Water' } },
  { properties: { LAND_USE: 'Forest' } },
];

describe('buildInitialVectorEditableMeta', () => {
  it('auto-picks the first likely-categorical field with no saved config', () => {
    const editable = buildInitialVectorEditableMeta(fields, null, features);
    expect(editable.mode).toBe('categorical');
    expect(editable.field).toBe('LAND_USE');
    expect(editable.classes.map((c) => c.value)).toEqual(['Forest', 'Water']);
  });

  it('falls back to single-color when no field looks categorical', () => {
    const idOnlyFields: VectorField[] = [
      { name: 'OBJECTID', type: 'number', likelyCategorical: false },
    ];
    const editable = buildInitialVectorEditableMeta(
      idOnlyFields,
      null,
      features,
    );
    expect(editable.mode).toBe('single');
    expect(editable.field).toBeNull();
    expect(editable.classes).toEqual([]);
  });

  it('restores a saved single-color config', () => {
    const saved: VectorSavedConfig = {
      mode: 'single',
      color: '#123456',
      field: null,
      classes: [],
    };
    const editable = buildInitialVectorEditableMeta(fields, saved, features);
    expect(editable).toEqual({
      mode: 'single',
      color: '#123456',
      field: null,
      classes: [],
    });
  });

  it('restores a saved categorical config when the field still exists', () => {
    const saved: VectorSavedConfig = {
      mode: 'categorical',
      color: null,
      field: 'LAND_USE',
      classes: [
        { value: 'Forest', name: 'Forest (renamed)', color: '#00ff00' },
      ],
    };
    const editable = buildInitialVectorEditableMeta(fields, saved, features);
    expect(editable.mode).toBe('categorical');
    expect(editable.field).toBe('LAND_USE');
    expect(editable.classes).toEqual([
      { value: 'Forest', name: 'Forest (renamed)', color: '#00ff00' },
    ]);
  });

  it('auto-picks a field if the saved categorical field no longer exists', () => {
    const saved: VectorSavedConfig = {
      mode: 'categorical',
      color: null,
      field: 'REMOVED_FIELD',
      classes: [{ value: 'x', name: 'x', color: '#000000' }],
    };
    const editable = buildInitialVectorEditableMeta(fields, saved, features);
    expect(editable.mode).toBe('categorical');
    expect(editable.field).toBe('LAND_USE');
  });
});

describe('distinctFieldValues', () => {
  it('returns distinct values in first-seen order', () => {
    expect(distinctFieldValues(features, 'LAND_USE')).toEqual([
      'Forest',
      'Water',
    ]);
  });

  it('skips null/undefined values', () => {
    const withNulls = [...features, { properties: { LAND_USE: null } }];
    expect(distinctFieldValues(withNulls, 'LAND_USE')).toEqual([
      'Forest',
      'Water',
    ]);
  });
});

describe('withCategoricalField', () => {
  it('switches to categorical mode and derives classes from the data', () => {
    const initial = buildInitialVectorEditableMeta(fields, null, features);
    const editable = withCategoricalField(initial, 'LAND_USE', features);
    expect(editable.mode).toBe('categorical');
    expect(editable.field).toBe('LAND_USE');
    expect(editable.classes.map((c) => c.value)).toEqual(['Forest', 'Water']);
    expect(editable.classes.every((c) => !!c.color)).toBe(true);
  });
});

describe('withSingleColor / withClassColor / withClassName', () => {
  it('updates the flat color in single mode', () => {
    const initial = buildInitialVectorEditableMeta(fields, null, features);
    expect(withSingleColor(initial, '#abcdef').color).toBe('#abcdef');
  });

  it('updates one class color/name without touching the others', () => {
    const initial = withCategoricalField(
      buildInitialVectorEditableMeta(fields, null, features),
      'LAND_USE',
      features,
    );
    const recolored = withClassColor(initial, 'Water', '#0000ff');
    expect(recolored.classes.find((c) => c.value === 'Water')?.color).toBe(
      '#0000ff',
    );
    expect(recolored.classes.find((c) => c.value === 'Forest')?.color).toBe(
      initial.classes.find((c) => c.value === 'Forest')?.color,
    );

    const renamed = withClassName(recolored, 'Water', 'Lake');
    expect(renamed.classes.find((c) => c.value === 'Water')?.name).toBe('Lake');
  });
});
