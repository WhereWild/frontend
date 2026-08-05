// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import OccurrenceRedirectPage from '../[id]';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchOccurrenceLookup } from '@/data/api';

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    useLocalSearchParams: jest.fn(),
    useRouter: jest.fn(),
  };
});

jest.mock('@/data/api', () => ({
  fetchOccurrenceLookup: jest.fn(),
}));

const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<
  typeof useLocalSearchParams
>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockFetchOccurrenceLookup =
  fetchOccurrenceLookup as jest.MockedFunction<typeof fetchOccurrenceLookup>;

const createRouterMock = () =>
  ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    dismissTo: jest.fn(),
    refresh: jest.fn(),
  }) as unknown as ReturnType<typeof useRouter>;

describe('OccurrenceRedirectPage', () => {
  let router: ReturnType<typeof createRouterMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    router = createRouterMock();
    mockUseRouter.mockReturnValue(router);
  });

  it('shows a loading state while resolving', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: '143391331' });
    mockFetchOccurrenceLookup.mockReturnValue(new Promise(() => {}));

    render(<OccurrenceRedirectPage />);

    expect(screen.getByText('Looking up observation...')).toBeTruthy();
  });

  it('redirects to the species page with highlightObservation on success', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: '143391331' });
    mockFetchOccurrenceLookup.mockResolvedValue({
      catalogNumber: '143391331',
      taxonId: '6SRLS',
      scientificName: 'Opuntia fragilis',
      commonName: 'Brittle Prickly Pear',
      slug: 'opuntia-fragilis',
      latitude: 40.5,
      longitude: -111.8,
      ingested: true,
    });

    render(<OccurrenceRedirectPage />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        '/species/6SRLS/opuntia-fragilis?highlightObservation=143391331',
      );
    });
    expect(mockFetchOccurrenceLookup).toHaveBeenCalledWith('143391331');
  });

  it('shows a not-found state when the lookup resolves to null', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'nope' });
    mockFetchOccurrenceLookup.mockResolvedValue(null);

    render(<OccurrenceRedirectPage />);

    await waitFor(() => {
      expect(screen.getByText('Observation not found')).toBeTruthy();
    });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows a not-found state when the lookup throws', async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: '143391331' });
    mockFetchOccurrenceLookup.mockRejectedValue(new Error('network down'));

    render(<OccurrenceRedirectPage />);

    await waitFor(() => {
      expect(screen.getByText('Observation not found')).toBeTruthy();
    });
  });

  it('shows a not-found state immediately when no id param is present', () => {
    mockUseLocalSearchParams.mockReturnValue({});

    render(<OccurrenceRedirectPage />);

    expect(screen.getByText('No observation id was provided.')).toBeTruthy();
    expect(mockFetchOccurrenceLookup).not.toHaveBeenCalled();
  });
});
