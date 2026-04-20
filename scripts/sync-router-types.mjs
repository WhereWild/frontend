#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const requireContext =
  require('expo-router/build/testing-library/require-context-ponyfill').default;
const {
  getTypedRoutesDeclarationFile,
} = require('expo-router/build/typed-routes/generate');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const appRoot = path.join(projectRoot, 'app');
const outputDir = path.join(projectRoot, '.expo', 'types');
const outputFile = path.join(outputDir, 'router.d.ts');

// Expo Router's watch-based generator runs against the app tree and, in this repo,
// will happily pick up colocated test files. Exclude test and mock directories so
// typed routes track actual navigable screens.
const ROUTE_CONTEXT_IGNORE =
  /^(?:\.\/)(?!.*__(?:tests|mocks)__\/)(?!(?:(?:(?:.*\+api)|(?:\+(html|native-intent))))\.[tj]sx?$).*\.[tj]sx?$/;

try {
  const ctx = requireContext(appRoot, true, ROUTE_CONTEXT_IGNORE);
  const content = getTypedRoutesDeclarationFile(ctx, {
    unstable_useServerMiddleware: true,
  });

  if (!content) {
    console.error('[sync-router-types] Failed to generate router.d.ts');
    process.exit(1);
  }

  mkdirSync(outputDir, { recursive: true });

  let previous = null;
  try {
    previous = readFileSync(outputFile, 'utf8');
  } catch {}

  if (previous === content) {
    console.log('[sync-router-types] router.d.ts already up to date');
    process.exit(0);
  }

  writeFileSync(outputFile, content);
  console.log('[sync-router-types] Updated .expo/types/router.d.ts');
} catch (error) {
  console.error('[sync-router-types] Error while syncing router types:', error);
  process.exit(1);
}
