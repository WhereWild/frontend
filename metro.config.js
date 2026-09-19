// SPDX-FileCopyrightText: 2025 650 Industries, Inc. (Expo)
// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

const path = require('path');
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
config.transformer.babelTransformerPath =
  require.resolve('./scripts/metro-md-transformer.js');

// geotiff's own package.json "browser" field stubs its Node built-ins for
// web, but native platforms don't read that field and load its Node build
// instead -- so an iOS/Android bundle fails to resolve "fs", and then trips
// on web-worker's Node build (a dynamic import() Metro can't bundle). The
// custom-layer/GIS-editor code only ever uses fromBlob/fromArrayBuffer, never
// geotiff's file, http, or worker-pool paths, so native gets what the browser
// build gets: empty modules for the built-ins, web-worker's browser build.
const GEOTIFF_STUBBED_BUILTINS = new Set(['fs', 'http', 'https', 'url']);
const WEB_WORKER_BROWSER_BUILD = path.resolve(
  __dirname,
  'node_modules/web-worker/dist/browser/index.cjs',
);
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform !== 'web' &&
    /[\\/]node_modules[\\/]geotiff[\\/]/.test(context.originModulePath)
  ) {
    if (GEOTIFF_STUBBED_BUILTINS.has(moduleName)) {
      return { type: 'empty' };
    }
    if (moduleName === 'web-worker') {
      return { type: 'sourceFile', filePath: WEB_WORKER_BROWSER_BUILD };
    }
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform,
  );
};

module.exports = config;
