// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchEnvironmentVariables } from '@/data/api';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { useEnvironmentVariableSelection } from '../useEnvironmentVariableSelection';

jest.mock('@/data/api', () => ({
  fetchEnvironmentVariables: jest.fn(),
}));

const mockFetchEnvironmentVariables =
  fetchEnvironmentVariables as jest.MockedFunction<
    typeof fetchEnvironmentVariables
  >;

function HookProbe(
  props: Parameters<typeof useEnvironmentVariableSelection>[0],
) {
  const state = useEnvironmentVariableSelection(props);

  return (
    <View>
      <Text testID='categories'>{JSON.stringify(state.categories)}</Text>
      <Text testID='filtered-variables'>
        {JSON.stringify(state.filteredVariables.map((item) => item.id))}
      </Text>
      <Text testID='selected-category'>
        {state.selectedVariableCategory ?? 'null'}
      </Text>
      <Text testID='selected-variable'>{state.selectedVariable}</Text>
      <Text testID='selected-meta'>
        {state.selectedVariableMeta?.id ?? 'null'}
      </Text>
      <Text testID='is-categorical'>{String(state.isVariableCategorical)}</Text>
    </View>
  );
}

describe('useEnvironmentVariableSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchEnvironmentVariables.mockReturnValue(
      new Promise(() => undefined) as never,
    );
  });

  it('selects the first available category and variable when the initial variable is absent', async () => {
    const { result } = renderHook(() =>
      useEnvironmentVariableSelection({
        variableId: 'unknown',
        variables: [
          {
            id: 'wind_speed',
            label: 'Wind Speed',
            category: 'Live Weather',
            valueType: 'continuous',
          },
          {
            id: 'landcover',
            label: 'Land Cover',
            category: 'Categorical',
            valueType: 'categorical',
          },
        ],
      }),
    );

    await waitFor(() => {
      expect(result.current.selectedVariableCategory).toBe('Categorical');
    });
    expect(result.current.selectedVariable).toBe('landcover');
    expect(result.current.filteredVariables.map((item) => item.id)).toEqual([
      'landcover',
    ]);
    expect(result.current.isVariableCategorical).toBe(true);
  });

  it('filters excluded categories from the remote catalog', async () => {
    mockFetchEnvironmentVariables.mockResolvedValueOnce([
      {
        id: 'temporal-only',
        name: 'Temporal Only',
        category: 'Temporal',
        valueType: 'continuous',
      },
      {
        id: 'recent-weather',
        name: 'Recent Weather',
        category: 'Recent Weather',
        valueType: 'continuous',
      },
      {
        id: 'wind_speed',
        name: 'Wind Speed',
        category: 'Live Weather',
        valueType: 'continuous',
      },
      {
        id: 'landcover',
        name: 'Land Cover',
        category: 'Categorical',
        valueType: 'categorical',
      },
    ] as never);

    render(
      <HookProbe
        variableId='wind_speed'
        excludeCategories={['Temporal', 'Recent Weather']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('categories').props.children).toBe(
        JSON.stringify(['Categorical', 'Live Weather']),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('filtered-variables').props.children).toBe(
        JSON.stringify(['landcover']),
      );
      expect(screen.getByTestId('selected-category').props.children).toBe(
        'Categorical',
      );
      expect(screen.getByTestId('selected-meta').props.children).toBe(
        'landcover',
      );
    });
  });

  it('treats excluded category names case-insensitively', async () => {
    mockFetchEnvironmentVariables.mockResolvedValueOnce([
      {
        id: 'temporal-only',
        name: 'Temporal Only',
        category: 'Temporal',
        valueType: 'continuous',
      },
      {
        id: 'recent-weather',
        name: 'Recent Weather',
        category: 'Recent Weather',
        valueType: 'continuous',
      },
      {
        id: 'wind_speed',
        name: 'Wind Speed',
        category: 'Live Weather',
        valueType: 'continuous',
      },
      {
        id: 'landcover',
        name: 'Land Cover',
        category: 'Categorical',
        valueType: 'categorical',
      },
    ] as never);

    render(
      <HookProbe
        variableId='wind_speed'
        excludeCategories={['temporal', 'RECENT WEATHER']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('categories').props.children).toBe(
        JSON.stringify(['Categorical', 'Live Weather']),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('selected-meta').props.children).toBe(
        'landcover',
      );
    });
  });

  it('does not fall back to default variables when exclusions remove the entire remote catalog', async () => {
    mockFetchEnvironmentVariables.mockResolvedValueOnce([
      {
        id: 'temporal-only',
        name: 'Temporal Only',
        category: 'Temporal',
        valueType: 'continuous',
      },
      {
        id: 'recent-weather',
        name: 'Recent Weather',
        category: 'Recent Weather',
        valueType: 'continuous',
      },
    ] as never);

    render(
      <HookProbe
        variableId='wind_speed'
        excludeCategories={['Temporal', 'Recent Weather']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('filtered-variables').props.children).toBe(
        JSON.stringify([]),
      );
    });
    expect(screen.getByTestId('categories').props.children).toBe(
      JSON.stringify([]),
    );
    expect(screen.getByTestId('selected-category').props.children).toBe('null');
    expect(screen.getByTestId('selected-meta').props.children).toBe('null');
  });

  it('updates the selected variable when the active category changes', async () => {
    const { result } = renderHook(() =>
      useEnvironmentVariableSelection({
        variableId: 'wind_speed',
        variables: [
          {
            id: 'wind_speed',
            label: 'Wind Speed',
            category: 'Live Weather',
            valueType: 'continuous',
          },
          {
            id: 'landcover',
            label: 'Land Cover',
            category: 'Categorical',
            valueType: 'categorical',
          },
        ],
      }),
    );

    await waitFor(() => {
      expect(result.current.selectedVariableCategory).toBe('Categorical');
    });

    act(() => {
      result.current.setSelectedVariableCategory('Live Weather');
    });

    await waitFor(() => {
      expect(result.current.selectedVariableCategory).toBe('Live Weather');
    });
    expect(result.current.selectedVariable).toBe('wind_speed');
    expect(result.current.selectedVariableMeta?.label).toBe('Wind Speed');
    expect(result.current.isVariableCategorical).toBe(false);
  });
});
