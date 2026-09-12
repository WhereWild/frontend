// SPDX-FileCopyrightText: 2025 650 Industries, Inc. (Expo)
// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    // geotiff+quick-lru: package.json "exports" resolves the bare `geotiff`
    // specifier (and geotiff's own internal deep imports) to its ESM
    // dist-module build under this Jest setup, regardless of the
    // moduleNameMapper override below — that build's own untranspiled ESM
    // (and quick-lru's, one of its deps) needs babel to run over it too.
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|marked|geotiff|quick-lru|xml-utils)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '\\.md$': '<rootDir>/test-utils/mdTransformer.js',
  },
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>',
        outputName: 'junit.xml',
      },
    ],
  ],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'constants/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
    '!app-example/**',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85,
    },
  },
  coverageReporters: ['json', 'json-summary', 'lcov', 'text', 'cobertura'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(html)$': '<rootDir>/test-utils/fileMock.js',
    // jest-expo's resolver prefers the "browser"/"module" package.json
    // fields (needed for React Native packages), which for `geotiff`
    // picks its ESM dist-module build — and that pulls in quick-lru's ESM
    // source, which babel-jest can't parse, so any test that reaches
    // `require('geotiff')` (even indirectly, e.g. via rasterMetadata.ts's
    // inspectRaster) fails outright. Force geotiff's own CJS build
    // (dist-node, what Node/Jest actually run) instead.
    '^geotiff$': '<rootDir>/node_modules/geotiff/dist-node/geotiff.js',
  },
  testEnvironment: 'node',
};
