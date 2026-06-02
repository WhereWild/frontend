module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
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
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'constants/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
    '!app-example/**'
  ],
  coverageThreshold: {
    global: {
      branches: 84,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  coverageReporters: ['json', 'json-summary', 'lcov', 'text', 'cobertura'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(html)$': '<rootDir>/test-utils/fileMock.js'
  },
  testEnvironment: 'node'
};
