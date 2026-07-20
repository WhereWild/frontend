// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { TernaryDensityChart } from '../TernaryDensityChart';
import type { TernaryCompositionDensity } from '@/data/types';
// Raw (snake_case) output of build_ternary_density_grid() +
// build_ternary_classification_overlay() (util/ternary.py) computed from
// Opuntia fragilis's (GBIF 5384113) actual occurrence-sampled clay/sand/silt
// -- exercises the real backend->frontend grid contract, not synthetic data.
// Columns were read in [clay, sand, silt] order to match soil_texture's
// catalog composition_axis ordering ([top, bottom_left, bottom_right]).
// Shaped like the wire payload, so it's mapped to the parsed camelCase
// TernaryCompositionDensity shape below, mirroring what
// coerceTernaryCompositionDensity (data/parsers/environment/responses.ts) does.
import rawOpuntiaFragilisSoilDensity from './fixtures/opuntiaFragilisSoilDensity.json';

const opuntiaFragilisSoilDensity: TernaryCompositionDensity = {
  resolution: rawOpuntiaFragilisSoilDensity.resolution,
  density: rawOpuntiaFragilisSoilDensity.density,
  classIds: rawOpuntiaFragilisSoilDensity.class_ids,
  classBoundaryA: rawOpuntiaFragilisSoilDensity.class_boundary_a,
  classBoundaryB: rawOpuntiaFragilisSoilDensity.class_boundary_b,
  sampleA: rawOpuntiaFragilisSoilDensity.sample_a,
  sampleB: rawOpuntiaFragilisSoilDensity.sample_b,
  sampleC: rawOpuntiaFragilisSoilDensity.sample_c,
};

// Matches the fixture's [clay, sand, silt] column order = [top, bottom_left, bottom_right].
const AXIS_LABELS: [string, string, string] = ['Clay', 'Sand', 'Silt'];

const mockReactLocal = React;
const mockRNView = View;
const mockRNText = Text;

jest.mock('react-native-svg', () => {
  const MockSvg = ({ children }: { children?: React.ReactNode }) =>
    mockReactLocal.createElement(mockRNView, { testID: 'svg-root' }, children);
  const MockPath = ({ testID }: { testID?: string }) =>
    mockReactLocal.createElement(
      mockRNView,
      { testID: testID ?? 'svg-path' },
      null,
    );
  const MockCircle = ({ testID }: { testID?: string }) =>
    mockReactLocal.createElement(
      mockRNView,
      { testID: testID ?? 'svg-circle' },
      null,
    );
  const MockText = ({ children }: { children?: React.ReactNode }) =>
    mockReactLocal.createElement(mockRNText, null, children);
  return {
    __esModule: true,
    default: MockSvg,
    Path: MockPath,
    Circle: MockCircle,
    Text: MockText,
  };
});

const COLORS = {
  fillColor: '#466237',
  contourColor: '#878787',
  textColor: '#2c2c2c',
};

describe('TernaryDensityChart', () => {
  it('renders an empty state when density is null', () => {
    render(
      <TernaryDensityChart
        density={null}
        axisLabels={AXIS_LABELS}
        {...COLORS}
      />,
    );
    expect(
      screen.getByText('Not enough data for a composition density plot.'),
    ).toBeTruthy();
  });

  it('renders the mesh, frame, class boundary lines, and corner labels for a real backend-shaped density grid', () => {
    const density = opuntiaFragilisSoilDensity;
    render(
      <TernaryDensityChart
        density={density}
        axisLabels={AXIS_LABELS}
        {...COLORS}
      />,
    );

    // Grid reconstruction: resolution N implies (N+1)(N+2)/2 vertices and
    // roughly N^2 faces (a full triangular tiling minus the corners).
    const n = density.resolution;
    const expectedVertices = ((n + 1) * (n + 2)) / 2;
    expect(density.density.length).toBe(expectedVertices);

    // Faces with zero density are skipped (not rendered), so this is an
    // upper bound, not exact equality — but it should be non-trivial and
    // never exceed the full 2*n*(n+1)/2-ish tiling count.
    const meshFaces = screen.getAllByTestId('ternary-density-mesh-face');
    expect(meshFaces.length).toBeGreaterThan(0);
    expect(meshFaces.length).toBeLessThanOrEqual(2 * n * n);

    expect(screen.getByTestId('ternary-density-frame')).toBeTruthy();
    expect(screen.getByTestId('ternary-density-class-boundary')).toBeTruthy();

    expect(screen.getByText('Clay')).toBeTruthy();
    expect(screen.getByText('Sand')).toBeTruthy();
    expect(screen.getByText('Silt')).toBeTruthy();
  });

  it('overlays sample dots only when showSampleDots is set', () => {
    const density = opuntiaFragilisSoilDensity;
    const { rerender } = render(
      <TernaryDensityChart
        density={density}
        axisLabels={AXIS_LABELS}
        {...COLORS}
      />,
    );
    expect(screen.queryAllByTestId('ternary-density-sample-dot')).toHaveLength(
      0,
    );

    rerender(
      <TernaryDensityChart
        density={density}
        axisLabels={AXIS_LABELS}
        showSampleDots
        {...COLORS}
      />,
    );
    const dots = screen.getAllByTestId('ternary-density-sample-dot');
    expect(dots.length).toBe(density.sampleA?.length ?? 0);
    expect(dots.length).toBeGreaterThan(0);
  });

  it('renders without classification data (density-only compositional variable)', () => {
    const densityOnly: TernaryCompositionDensity = {
      resolution: opuntiaFragilisSoilDensity.resolution,
      density: opuntiaFragilisSoilDensity.density,
    };
    render(
      <TernaryDensityChart
        density={densityOnly}
        axisLabels={AXIS_LABELS}
        {...COLORS}
      />,
    );
    expect(screen.getByTestId('ternary-density-frame')).toBeTruthy();
    expect(screen.queryByTestId('ternary-density-class-boundary')).toBeNull();
  });

  it('handles a density grid with no positive density gracefully (no crash, no mesh faces)', () => {
    const flatDensity: TernaryCompositionDensity = {
      resolution: 2,
      density: [0, 0, 0, 0, 0, 0],
    };
    render(
      <TernaryDensityChart
        density={flatDensity}
        axisLabels={AXIS_LABELS}
        {...COLORS}
      />,
    );
    expect(screen.queryAllByTestId('ternary-density-mesh-face')).toHaveLength(
      0,
    );
    expect(screen.getByTestId('ternary-density-frame')).toBeTruthy();
  });
});
