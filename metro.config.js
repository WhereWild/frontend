// SPDX-FileCopyrightText: 2025 650 Industries, Inc. (Expo)
// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('html')) {
  config.resolver.assetExts.push('html');
}

// .md files are imported as raw text (see scripts/metro-md-transformer.js),
// not treated as assets or parsed as JS source.
if (!config.resolver.sourceExts.includes('md')) {
  config.resolver.sourceExts.push('md');
}
config.transformer.babelTransformerPath = require.resolve(
  './scripts/metro-md-transformer.js',
);

module.exports = config;