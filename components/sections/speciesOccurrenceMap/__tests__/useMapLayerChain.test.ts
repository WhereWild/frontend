// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import type { LegendRange } from '../legendRangeSelection';
import { useMapLayerChain } from '../useMapLayerChain';

const ALL_VARIABLES: EnvironmentVariableOption[] = [
  {
    id: 'landcover',
    label: 'Land Cover',
    valueType: 'categorical',
    legendClasses: [
      { id: 10, name: 'Forest' },
      { id: 20, name: 'Grassland' },
    ],
  },
  {
    id: 'bio1',
    label: 'Annual Mean Temperature',
    valueType: 'continuous',
    units: '°C',
  },
  { id: 'aspect', label: 'Aspect', valueType: 'circular' },
];

const isCategoricalId = (id: string) =>
  ALL_VARIABLES.find((v) => v.id === id)?.valueType === 'categorical';
const isCircularId = (id: string) =>
  ALL_VARIABLES.find((v) => v.id === id)?.valueType === 'circular';

/** Test harness: owns the 3 live-selection states like app/maps.tsx does,
 * and exposes setters so a test can simulate the user making a selection
 * while a given variable is active, then switch variables. */
function useHarness(initialVariable: string) {
  const [selectedVariable, setSelectedVariable] =
    React.useState(initialVariable);
  const [selectedClassIds, setSelectedClassIds] = React.useState<number[]>([]);
  const [selectedValueRanges, setSelectedValueRanges] = React.useState<
    LegendRange[]
  >([]);
  const [selectedAngleRanges, setSelectedAngleRanges] = React.useState<
    LegendRange[]
  >([]);

  const chainState = useMapLayerChain({
    selectedVariable,
    isCategorical: isCategoricalId(selectedVariable),
    isCircular: isCircularId(selectedVariable),
    allVariables: ALL_VARIABLES,
    selectedClassIds,
    selectedValueRanges,
    selectedAngleRanges,
    setSelectedClassIds,
    setSelectedValueRanges,
    setSelectedAngleRanges,
  });

  return {
    selectedVariable,
    setSelectedVariable,
    selectedClassIds,
    setSelectedClassIds,
    selectedValueRanges,
    setSelectedValueRanges,
    selectedAngleRanges,
    setSelectedAngleRanges,
    ...chainState,
  };
}

describe('useMapLayerChain', () => {
  it('does nothing when switching away with no active selection', () => {
    const { result } = renderHook(() => useHarness('landcover'));
    act(() => {
      result.current.setSelectedVariable('bio1');
    });
    expect(result.current.chain).toEqual([]);
  });

  it('stashes a categorical selection as a chain entry when switching to another variable', () => {
    const { result } = renderHook(() => useHarness('landcover'));
    act(() => {
      result.current.setSelectedClassIds([10]);
    });
    act(() => {
      result.current.setSelectedVariable('bio1');
    });

    expect(result.current.chain).toHaveLength(1);
    expect(result.current.chain[0]).toMatchObject({
      layerId: 'landcover',
      isCategorical: true,
      label: 'Forest',
      extra: { layer_id: 'landcover', class_filter: [10] },
    });
    // Switching away clears the live selection for the new variable.
    expect(result.current.selectedClassIds).toEqual([]);
  });

  it('restores a stashed categorical selection when switching back to it', () => {
    const { result } = renderHook(() => useHarness('landcover'));
    act(() => {
      result.current.setSelectedClassIds([10, 20]);
    });
    act(() => {
      result.current.setSelectedVariable('bio1');
    });
    act(() => {
      result.current.setSelectedVariable('landcover');
    });

    expect(result.current.chain).toEqual([]);
    expect(result.current.selectedClassIds).toEqual([10, 20]);
  });

  it('stashes and restores a continuous value range (single range)', () => {
    const { result } = renderHook(() => useHarness('bio1'));
    act(() => {
      result.current.setSelectedValueRanges([{ min: 1, max: 5 }]);
    });
    act(() => {
      result.current.setSelectedVariable('landcover');
    });
    expect(result.current.chain).toMatchObject([
      {
        layerId: 'bio1',
        isCategorical: false,
        isCircular: false,
        extra: { value_ranges: [[1, 5]] },
      },
    ]);
    expect(result.current.selectedValueRanges).toEqual([]);

    act(() => {
      result.current.setSelectedVariable('bio1');
    });
    expect(result.current.chain).toEqual([]);
    expect(result.current.selectedValueRanges).toEqual([{ min: 1, max: 5 }]);
  });

  it('stashes and restores multiple disjoint continuous value ranges', () => {
    const { result } = renderHook(() => useHarness('bio1'));
    act(() => {
      result.current.setSelectedValueRanges([
        { min: 1, max: 5 },
        { min: 10, max: 20 },
      ]);
    });
    act(() => {
      result.current.setSelectedVariable('landcover');
    });
    expect(result.current.chain).toMatchObject([
      {
        layerId: 'bio1',
        extra: {
          value_ranges: [
            [1, 5],
            [10, 20],
          ],
        },
      },
    ]);

    act(() => {
      result.current.setSelectedVariable('bio1');
    });
    expect(result.current.selectedValueRanges).toEqual([
      { min: 1, max: 5 },
      { min: 10, max: 20 },
    ]);
  });

  it('stashes and restores a circular angle range', () => {
    const { result } = renderHook(() => useHarness('aspect'));
    act(() => {
      result.current.setSelectedAngleRanges([{ min: 310, max: 45 }]);
    });
    act(() => {
      result.current.setSelectedVariable('bio1');
    });
    expect(result.current.chain).toMatchObject([
      {
        layerId: 'aspect',
        isCircular: true,
        extra: { value_ranges: [[310, 45]] },
      },
    ]);

    act(() => {
      result.current.setSelectedVariable('aspect');
    });
    expect(result.current.chain).toEqual([]);
    expect(result.current.selectedAngleRanges).toEqual([{ min: 310, max: 45 }]);
  });

  it('keeps multiple chained layers when switching through several', () => {
    const { result } = renderHook(() => useHarness('landcover'));
    act(() => {
      result.current.setSelectedClassIds([10]);
    });
    act(() => {
      result.current.setSelectedVariable('bio1');
    });
    act(() => {
      result.current.setSelectedValueRanges([{ min: 1, max: 5 }]);
    });
    act(() => {
      result.current.setSelectedVariable('aspect');
    });

    expect(result.current.chain.map((e) => e.layerId).sort()).toEqual([
      'bio1',
      'landcover',
    ]);
  });

  it('removeChainedFilter removes just one entry', () => {
    const { result } = renderHook(() => useHarness('landcover'));
    act(() => {
      result.current.setSelectedClassIds([10]);
    });
    act(() => {
      result.current.setSelectedVariable('bio1');
    });
    act(() => {
      result.current.setSelectedValueRanges([{ min: 1, max: 5 }]);
    });
    act(() => {
      result.current.setSelectedVariable('aspect');
    });
    act(() => {
      result.current.removeChainedFilter('landcover');
    });
    expect(result.current.chain.map((e) => e.layerId)).toEqual(['bio1']);
  });

  it('clearChain empties the whole chain', () => {
    const { result } = renderHook(() => useHarness('landcover'));
    act(() => {
      result.current.setSelectedClassIds([10]);
    });
    act(() => {
      result.current.setSelectedVariable('bio1');
    });
    act(() => {
      result.current.clearChain();
    });
    expect(result.current.chain).toEqual([]);
  });
});
