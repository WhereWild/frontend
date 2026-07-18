// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook } from '@testing-library/react-native';
import {
  useVariableGroupSelection,
  type VariableGroupInfo,
} from '../useVariableGroupSelection';

describe('useVariableGroupSelection', () => {
  it('treats a plain, ungrouped variable as its own base with no window/aggregate options', () => {
    const variableOptions = [{ label: 'Temperature', value: 'bio1' }];
    const variableDefinitions: VariableGroupInfo[] = [{ id: 'bio1' }];

    const { result } = renderHook(() =>
      useVariableGroupSelection({
        variableOptions,
        variableDefinitions,
        selectedValue: 'bio1',
      }),
    );

    expect(result.current.baseVariableOptions).toEqual([
      { label: 'Temperature', value: 'bio1' },
    ]);
    expect(result.current.selectedBaseKey).toBe('bio1');
    expect(result.current.windowOptions).toEqual([]);
    expect(result.current.climateAggOptions).toEqual([]);
  });

  it('collapses temporal variants into one base option and lists windows sorted ascending', () => {
    const variableOptions = [
      { label: 'Cloud Cover (Avg, 168h)', value: 'cloud_cover_avg_168h' },
      { label: 'Cloud Cover (Avg, 24h)', value: 'cloud_cover_avg_24h' },
    ];
    const variableDefinitions: VariableGroupInfo[] = [
      { id: 'cloud_cover_avg_168h' },
      { id: 'cloud_cover_avg_24h' },
    ];

    const { result } = renderHook(() =>
      useVariableGroupSelection({
        variableOptions,
        variableDefinitions,
        selectedValue: 'cloud_cover_avg_24h',
      }),
    );

    expect(result.current.baseVariableOptions).toEqual([
      { label: 'Cloud Cover', value: 'cloud_cover' },
    ]);
    expect(result.current.selectedBaseKey).toBe('cloud_cover');
    expect(result.current.windowOptions.map((o) => o.value)).toEqual([
      'cloud_cover_avg_24h',
      'cloud_cover_avg_168h',
    ]);
    expect(result.current.climateAggOptions).toEqual([]);
  });

  it('collapses climate-aggregate group variants into one base option with aggregate choices', () => {
    const variableOptions = [
      { label: 'Bio1 mean', value: 'bio1_mean' },
      { label: 'Bio1 min', value: 'bio1_min' },
      { label: 'Bio1 max', value: 'bio1_max' },
    ];
    const variableDefinitions: VariableGroupInfo[] = [
      { id: 'bio1_mean', group: 'bio1', groupLabel: 'Annual Temperature', agg: 'mean', units: '°C' },
      { id: 'bio1_min', group: 'bio1', groupLabel: 'Annual Temperature', agg: 'min', units: '°C' },
      { id: 'bio1_max', group: 'bio1', groupLabel: 'Annual Temperature', agg: 'max', units: '°C' },
    ];

    const { result } = renderHook(() =>
      useVariableGroupSelection({
        variableOptions,
        variableDefinitions,
        selectedValue: 'bio1_min',
      }),
    );

    expect(result.current.baseVariableOptions).toEqual([
      { label: 'Annual Temperature (°C)', value: 'bio1' },
    ]);
    expect(result.current.selectedBaseKey).toBe('bio1');
    expect(result.current.windowOptions).toEqual([]);
    expect(result.current.climateAggOptions.map((o) => o.value)).toEqual([
      'bio1_mean',
      'bio1_min',
      'bio1_max',
    ]);
  });

  it('onBaseChange picks the smallest time window when switching to a temporal base', () => {
    const variableOptions = [
      { label: 'Cloud Cover (Avg, 168h)', value: 'cloud_cover_avg_168h' },
      { label: 'Cloud Cover (Avg, 24h)', value: 'cloud_cover_avg_24h' },
    ];
    const variableDefinitions: VariableGroupInfo[] = [
      { id: 'cloud_cover_avg_168h' },
      { id: 'cloud_cover_avg_24h' },
    ];
    const onSelectedValueChange = jest.fn();

    const { result } = renderHook(() =>
      useVariableGroupSelection({
        variableOptions,
        variableDefinitions,
        selectedValue: '',
        onSelectedValueChange,
      }),
    );

    result.current.onBaseChange('cloud_cover');

    expect(onSelectedValueChange).toHaveBeenCalledWith('cloud_cover_avg_24h');
  });

  it('onBaseChange picks the mean aggregate variant when switching to a climate-aggregate group', () => {
    const variableOptions = [
      { label: 'Bio1 min', value: 'bio1_min' },
      { label: 'Bio1 mean', value: 'bio1_mean' },
      { label: 'Bio1 max', value: 'bio1_max' },
    ];
    const variableDefinitions: VariableGroupInfo[] = [
      { id: 'bio1_min', group: 'bio1', agg: 'min' },
      { id: 'bio1_mean', group: 'bio1', agg: 'mean' },
      { id: 'bio1_max', group: 'bio1', agg: 'max' },
    ];
    const onSelectedValueChange = jest.fn();

    const { result } = renderHook(() =>
      useVariableGroupSelection({
        variableOptions,
        variableDefinitions,
        selectedValue: '',
        onSelectedValueChange,
      }),
    );

    result.current.onBaseChange('bio1');

    expect(onSelectedValueChange).toHaveBeenCalledWith('bio1_mean');
  });

  it('onBaseChange passes a plain ungrouped variable through unchanged', () => {
    const variableOptions = [{ label: 'Elevation', value: 'elevation' }];
    const variableDefinitions: VariableGroupInfo[] = [{ id: 'elevation' }];
    const onSelectedValueChange = jest.fn();

    const { result } = renderHook(() =>
      useVariableGroupSelection({
        variableOptions,
        variableDefinitions,
        selectedValue: '',
        onSelectedValueChange,
      }),
    );

    result.current.onBaseChange('elevation');

    expect(onSelectedValueChange).toHaveBeenCalledWith('elevation');
  });
});
