// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useColorScheme } from '@/hooks/useColorScheme';
import { uploadRawObservations } from '@/data/api';
import { parseUploadedParquetZipToRawBundle } from '@/data/uploadZipParquetParser';
import * as Haptics from 'expo-haptics';
import {
  normalizeRawUploadedParquetBundle,
  buildUploadLocalSpeciesDataSource,
  type RawUploadedParquetBundle,
} from '@/data/uploadLocalSpeciesDataSource';
import { render, screen, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import Upload from '@/app/upload';

export const mockUseResponsive = jest.fn(() => ({
  breakpoint: 'desktop',
  contentWidth: 1200,
  gap: 32,
  marginHorizontal: 32,
}));

export const mockFileCreate = jest.fn();
export const mockFileWrite = jest.fn();
export const mockPickDirectoryAsync = jest.fn();
export const mockGetDocumentAsync = jest.fn();
export const mockShareAsync = jest.fn();
export const mockIsShareAvailableAsync = jest.fn();

jest.mock('@/components', () => {
  const ReactLocal = jest.requireActual('react');
  const actual = jest.requireActual('@/components');
  const { Pressable, Text } = jest.requireActual('react-native');

  return {
    ...actual,
    SpeciesEnvironmentSection: ({
      pinnedObservation,
    }: {
      pinnedObservation?: {
        catalogNumber: string;
        lat: number;
        lon: number;
      } | null;
    }) =>
      ReactLocal.createElement(
        ReactLocal.Fragment,
        null,
        ReactLocal.createElement(
          actual.ThemedText,
          { variant: 'heading' },
          'Species Environment',
        ),
        ReactLocal.createElement(
          Text,
          { testID: 'mock-pinned-observation' },
          pinnedObservation?.catalogNumber ?? 'none',
        ),
      ),
    SpeciesOccurrenceMap: ({
      linkObservations,
      onPinObservation,
      selectedPoint,
    }: {
      linkObservations?: boolean;
      onPinObservation?: (
        catalogNumber: string,
        lat: number,
        lon: number,
      ) => void;
      selectedPoint?: { lat: number; lon: number } | null;
    }) =>
      ReactLocal.createElement(
        ReactLocal.Fragment,
        null,
        ReactLocal.createElement(
          actual.ThemedText,
          { variant: 'body' },
          `Map links ${String(linkObservations)}`,
        ),
        ReactLocal.createElement(
          Text,
          { testID: 'mock-selected-point' },
          selectedPoint ? `${selectedPoint.lat},${selectedPoint.lon}` : 'none',
        ),
        ReactLocal.createElement(
          Pressable,
          {
            testID: 'mock-pin-observation',
            onPress: () => onPinObservation?.('obs_1', 10, 20),
          },
          ReactLocal.createElement(Text, null, 'Pin observation'),
        ),
      ),
  };
});

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;

    constructor(...uris: (string | { uri: string })[]) {
      const first = uris[0];
      this.uri =
        typeof first === 'string' ? first : (first?.uri ?? 'file://unknown/');
    }

    static pickDirectoryAsync(...args: unknown[]) {
      return mockPickDirectoryAsync(...args);
    }
  }

  class MockFile {
    uri: string;

    constructor(...uris: (string | { uri: string })[]) {
      const parent = uris[0];
      const name = String(uris[1] ?? 'file.bin');
      const parentUri =
        typeof parent === 'string'
          ? parent
          : (parent?.uri ?? 'file://unknown/');
      const normalizedParentUri = parentUri.endsWith('/')
        ? parentUri
        : `${parentUri}/`;
      this.uri = `${normalizedParentUri}${name}`;
    }

    create(...args: unknown[]) {
      return mockFileCreate(...args);
    }

    write(...args: unknown[]) {
      return mockFileWrite(...args);
    }
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: {
      cache: { uri: 'file://cache/' },
    },
  };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsShareAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock('@/data/api', () => ({
  uploadRawObservations: jest.fn(),
  fetchDataSources: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/data/uploadZipParquetParser', () => ({
  parseUploadedParquetZipToRawBundle: jest.fn(),
  UploadZipParseError: Error,
}));

jest.mock('@/data/uploadLocalSpeciesDataSource', () => ({
  normalizeRawUploadedParquetBundle: jest.fn(),
  buildUploadLocalSpeciesDataSource: jest.fn(),
  UploadedParquetBundleValidationError: Error,
}));

export const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

export const mockUploadRawObservations =
  uploadRawObservations as jest.MockedFunction<typeof uploadRawObservations>;

export const mockParseZip =
  parseUploadedParquetZipToRawBundle as jest.MockedFunction<
    typeof parseUploadedParquetZipToRawBundle
  >;

export const mockNormalize =
  normalizeRawUploadedParquetBundle as jest.MockedFunction<
    typeof normalizeRawUploadedParquetBundle
  >;

export const mockBuildDataSource =
  buildUploadLocalSpeciesDataSource as jest.MockedFunction<
    typeof buildUploadLocalSpeciesDataSource
  >;

export const mockImpactAsync = Haptics.impactAsync as jest.MockedFunction<
  typeof Haptics.impactAsync
>;

export const mockNotificationAsync =
  Haptics.notificationAsync as jest.MockedFunction<
    typeof Haptics.notificationAsync
  >;

const originalFile = (global as { File?: unknown }).File;
const originalFileReader = (global as { FileReader?: unknown }).FileReader;
const originalFetch = global.fetch;
const originalXMLHttpRequest = global.XMLHttpRequest;
const originalPlatformOS = Platform.OS;

if (typeof (global as { File?: unknown }).File === 'undefined') {
  (global as { File?: unknown }).File = class MockFile {};
}

export const setPlatformOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

export const makePickerSelection = (assets: Record<string, unknown>[]) => ({
  canceled: false,
  assets,
});

export const makeDocumentAsset = ({
  uri,
  name,
  mimeType,
  file,
}: {
  uri: string;
  name: string;
  mimeType: string;
  file?: File;
}) => ({
  uri,
  name,
  mimeType,
  ...(file ? { file } : {}),
});

export const makeFile = (content: string, name: string, type: string) =>
  new File([content], name, { type });

export const mockPickerWithCsvFile = () => {
  const file = makeFile('lat,lon\n1,2', 'observations.csv', 'text/csv');
  mockGetDocumentAsync.mockResolvedValue(
    makePickerSelection([
      makeDocumentAsset({
        uri: 'file://observations.csv',
        name: 'observations.csv',
        mimeType: 'text/csv',
        file,
      }),
    ]),
  );
  return file;
};

export const mockPickerWithZipFile = (overrides?: {
  uri?: string;
  name?: string;
  file?: File;
}) => {
  const name = overrides?.name ?? 'data.zip';
  const uri = overrides?.uri ?? `file://${name}`;
  const file = overrides?.file;
  mockGetDocumentAsync.mockResolvedValue(
    makePickerSelection([
      makeDocumentAsset({
        uri,
        name,
        mimeType: 'application/zip',
        ...(file ? { file } : {}),
      }),
    ]),
  );
  return file;
};

export const pressUploadButton = (index: number) => {
  fireEvent.press(screen.getAllByLabelText('Upload')[index]);
};

export const makeUploadPreviewDataSource = () => ({
  fetchEnvironmentVariables: jest.fn().mockResolvedValue([
    {
      id: 'bio_1',
      name: 'Mean Annual Temperature',
      variableCategory: null,
      units: '°C',
      valueType: 'continuous',
    },
  ]),
  fetchSpeciesEnvironment: jest.fn().mockResolvedValue({
    histogram: [{ bin: 0, value: 1 }],
    density: [{ x: 0, y: 0.5 }],
    stats: { mean: 15, min: 10, max: 20, median: 15, q25: 12, q75: 18 },
  }),
  fetchEnvironmentRangeSlice: jest.fn().mockResolvedValue([]),
  fetchSpeciesEnvironmentCategorySamples: jest.fn().mockResolvedValue(null),
  fetchSpeciesOccurrences: jest.fn().mockResolvedValue([]),
  fetchSpeciesLocations: jest.fn().mockResolvedValue([]),
});

export const makeRawBundle = (): RawUploadedParquetBundle => ({
  categoricalStats: [],
  densityGraph: [],
  occurrences: [
    { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
  ],
  occurrenceIndex: [],
  summaryStats: [],
  variableMetadata: [],
});

export const makeNormalizedBundle = () => ({
  categoricalStats: [],
  densityGraph: [],
  occurrences: [{ catalogNumber: 'obs_1', latitude: 10, longitude: 20 }],
  occurrenceIndex: [],
  summaryStats: [],
  variableDefinitions: [],
});

export const initializeUploadTestState = () => {
  jest.clearAllMocks();
  mockUseResponsive.mockReturnValue({
    breakpoint: 'desktop',
    contentWidth: 1200,
    gap: 32,
    marginHorizontal: 32,
  });
  mockUseColorScheme.mockReturnValue('dark');
  mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
  mockFileCreate.mockReturnValue(undefined);
  mockFileWrite.mockReturnValue(undefined);
  mockPickDirectoryAsync.mockResolvedValue({ uri: 'file://picked-dir/' });
  mockIsShareAvailableAsync.mockResolvedValue(true);
  mockShareAsync.mockResolvedValue(undefined);
  mockImpactAsync.mockResolvedValue(undefined);
  mockNotificationAsync.mockResolvedValue(undefined);
  mockParseZip.mockResolvedValue(makeRawBundle());
  mockNormalize.mockReturnValue(makeNormalizedBundle());
  mockBuildDataSource.mockReturnValue(makeUploadPreviewDataSource());
  global.fetch = originalFetch;
  global.XMLHttpRequest = originalXMLHttpRequest;
  (global as { FileReader?: unknown }).FileReader = originalFileReader;
  setPlatformOS(originalPlatformOS);
  return jest.spyOn(console, 'error').mockImplementation(() => undefined);
};

export const restoreUploadTestState = (consoleErrorSpy: jest.SpyInstance) => {
  consoleErrorSpy.mockRestore();
};

export const restoreUploadTestGlobals = () => {
  (global as { File?: unknown }).File = originalFile;
  global.fetch = originalFetch;
  global.XMLHttpRequest = originalXMLHttpRequest;
};

export const renderUpload = () => render(<Upload />);
