// SPDX-FileCopyrightText: 2025 650 Industries, Inc. (Expo)
//
// SPDX-License-Identifier: MIT

// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    // 'dist/*' only matched files directly inside dist/, not nested ones
    // (dist/client/_expo/static/js/web/entry-*.js etc.) — ESLint was
    // parsing full minified production bundles on every run. coverage/
    // (Jest's instrumented HTML/JS output) was never excluded at all.
    // offlineFallbackPartials/*.partial.js are raw text fragments spliced
    // into the offline map HTML templates at build time (see
    // scripts/regenerate-offline-map-templates.mjs) — not standalone
    // modules, and linting them together as a group was pathologically
    // slow (a single file lints in ~2s; the 10-file folder didn't finish
    // in 2+ minutes) — they were never meant to be linted at all.
    ignores: [
      'dist/**',
      'coverage/**',
      'components/sections/speciesOccurrenceMap/offlineFallbackPartials/**',
    ],
  },
]);
