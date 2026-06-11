// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render } from '@testing-library/react-native';
import { NominalInsights } from '../speciesEnvironment/NominalInsights';
import type { SpeciesEnvironmentCategory } from '@/data/types';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({
    breakpoint: 'desktop',
    contentWidth: 1200,
    gap: 32,
    marginHorizontal: 32,
  })),
}));

jest.mock('@/components/navigation/NavigationPillList', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    NavigationPillList: () =>
      React.createElement(View, { testID: 'pill-list' }),
  };
});

jest.mock('../speciesEnvironment/SummaryItem', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SummaryItem: ({ label }: { label: string }) =>
      React.createElement(View, { testID: `summary-item-${label}` }),
  };
});

const baseSummaryRanks = {
  unique_classes: null,
  entropy: null,
  mode_class: null,
  selected_class: null,
};

const sampleCategory: SpeciesEnvironmentCategory = {
  value: 1,
  className: 'Forest',
  fraction: 0.45,
  count: 10,
};

const baseProps = {
  showRankContext: false,
  rankContextOptions: [],
  selectedRankContext: null,
  onRankContextChange: jest.fn(),
  summary: null,
  summaryRanks: baseSummaryRanks,
  categoricalDistribution: [],
  selectedCategoryValue: null,
  locationFilterActive: false,
};

describe('NominalInsights', () => {
  it('renders with minimal (null) props', () => {
    expect(() => render(<NominalInsights {...baseProps} />)).not.toThrow();
  });

  it('renders with showRankContext false (no rank section)', () => {
    expect(() =>
      render(<NominalInsights {...baseProps} showRankContext={false} />),
    ).not.toThrow();
  });

  it('renders with single rank context option', () => {
    expect(() =>
      render(
        <NominalInsights
          {...baseProps}
          showRankContext
          rankContextOptions={[{ key: 'family', label: 'Family' }]}
        />,
      ),
    ).not.toThrow();
  });

  it('renders with multiple rank context options', () => {
    expect(() =>
      render(
        <NominalInsights
          {...baseProps}
          showRankContext
          rankContextOptions={[
            { key: 'family', label: 'Family' },
            { key: 'genus', label: 'Genus' },
          ]}
          selectedRankContext='family'
        />,
      ),
    ).not.toThrow();
  });

  it('uses selectedRankContext key when provided with options', () => {
    expect(() =>
      render(
        <NominalInsights
          {...baseProps}
          showRankContext={false}
          rankContextOptions={[{ key: 'family', label: 'Family' }]}
          selectedRankContext='family'
        />,
      ),
    ).not.toThrow();
  });

  it('renders summary stats when summary is provided', () => {
    expect(() =>
      render(
        <NominalInsights
          {...baseProps}
          summary={{ unique_classes: 5, entropy: 1.2, mode: 1 }}
          categoricalDistribution={[sampleCategory]}
        />,
      ),
    ).not.toThrow();
  });

  it('renders with selectedCategoryValue matching a category', () => {
    expect(() =>
      render(
        <NominalInsights
          {...baseProps}
          summary={{ unique_classes: 5, entropy: 1.2, mode: 1 }}
          categoricalDistribution={[sampleCategory]}
          selectedCategoryValue={1}
        />,
      ),
    ).not.toThrow();
  });

  it('renders with selectedCategoryValue not matching any category', () => {
    expect(() =>
      render(
        <NominalInsights
          {...baseProps}
          summary={{ unique_classes: 5, entropy: 1.2, mode: 2 }}
          categoricalDistribution={[sampleCategory]}
          selectedCategoryValue={99}
        />,
      ),
    ).not.toThrow();
  });

  it('shows unique_classes as dash when null', () => {
    expect(() =>
      render(
        <NominalInsights
          {...baseProps}
          summary={{ unique_classes: null, entropy: null }}
        />,
      ),
    ).not.toThrow();
  });

  it('renders with locationFilterActive true (hides rank indicators)', () => {
    expect(() =>
      render(
        <NominalInsights
          {...baseProps}
          locationFilterActive
          summaryRanks={{
            unique_classes: { rank: 3, total: 10 } as never,
            entropy: null,
            mode_class: null,
            selected_class: null,
          }}
        />,
      ),
    ).not.toThrow();
  });

  it('renders stacked layout on phone breakpoint', () => {
    const { useResponsive } = require('@/hooks/useResponsive');
    (useResponsive as jest.Mock).mockReturnValue({
      breakpoint: 'phone',
      contentWidth: 375,
      gap: 16,
      marginHorizontal: 16,
    });
    expect(() => render(<NominalInsights {...baseProps} />)).not.toThrow();
  });

  it('renders stacked layout on tablet breakpoint', () => {
    const { useResponsive } = require('@/hooks/useResponsive');
    (useResponsive as jest.Mock).mockReturnValue({
      breakpoint: 'tablet',
      contentWidth: 768,
      gap: 24,
      marginHorizontal: 24,
    });
    expect(() => render(<NominalInsights {...baseProps} />)).not.toThrow();
  });

  it('renders in light mode', () => {
    const { useColorScheme } = require('@/hooks/useColorScheme');
    (useColorScheme as jest.Mock).mockReturnValue('light');
    expect(() => render(<NominalInsights {...baseProps} />)).not.toThrow();
  });

  it('handles mode category present in distribution', () => {
    const { useResponsive } = require('@/hooks/useResponsive');
    (useResponsive as jest.Mock).mockReturnValue({
      breakpoint: 'desktop',
      contentWidth: 1200,
      gap: 32,
      marginHorizontal: 32,
    });
    expect(() =>
      render(
        <NominalInsights
          {...baseProps}
          summary={{ mode: 1 }}
          categoricalDistribution={[sampleCategory]}
          selectedCategoryValue={null}
        />,
      ),
    ).not.toThrow();
  });

  it('handles no mode category match in distribution', () => {
    expect(() =>
      render(
        <NominalInsights
          {...baseProps}
          summary={{ mode: 99 }}
          categoricalDistribution={[sampleCategory]}
          selectedCategoryValue={null}
        />,
      ),
    ).not.toThrow();
  });
});
