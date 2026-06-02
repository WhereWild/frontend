#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse } from 'dotenv';

const passThroughArgs = process.argv.slice(2);
const requestedDotenvPath = process.env.EXPO_DOTENV;
const requestedAppVariant = process.env.APP_VARIANT;
const activeEnvMode = requestedDotenvPath ?? 'expo-default';
const defaultAppVariant = requestedDotenvPath ? 'production' : 'development';
const envStatePath = '.expo/start-env-mode';

const shouldManageMetroCache = !passThroughArgs.includes('--clear');

const readPreviousEnvMode = () => {
  if (!existsSync(envStatePath)) {
    return null;
  }

  try {
    return readFileSync(envStatePath, 'utf8').trim() || null;
  } catch {
    return null;
  }
};

const persistActiveEnvMode = () => {
  try {
    mkdirSync(dirname(envStatePath), { recursive: true });
    writeFileSync(envStatePath, `${activeEnvMode}\n`);
  } catch {
    // Ignore cache bookkeeping failures and continue starting Expo.
  }
};

let env = { ...process.env };

if (requestedDotenvPath) {
  if (!existsSync(requestedDotenvPath)) {
    console.error(
      `[start.mjs] Refusing to start: env file not found: ${requestedDotenvPath}`
    );
    process.exit(1);
  }

  env = {
    ...parse(readFileSync(requestedDotenvPath)),
    ...process.env,
  };
  env.EXPO_NO_DOTENV = '1';
  delete env.EXPO_DOTENV;
}

if (!requestedAppVariant) {
  env.APP_VARIANT = defaultAppVariant;
}

let exitCode = 1;

try {
  const previousEnvMode = shouldManageMetroCache ? readPreviousEnvMode() : null;
  const shouldClearCache =
    shouldManageMetroCache && previousEnvMode !== null && previousEnvMode !== activeEnvMode;

  const effectiveArgs = shouldClearCache ? [...passThroughArgs, '--clear'] : passThroughArgs;

  console.log('[start.mjs] EXPO_DOTENV:', requestedDotenvPath ?? '(unset)');
  if (shouldClearCache) {
    console.log(
      `[start.mjs] Switching env mode from ${previousEnvMode} to ${activeEnvMode}; starting Expo with --clear`
    );
  }

  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['expo', 'start', ...effectiveArgs],
    { stdio: 'inherit', shell: false, env }
  );

  exitCode = result.status ?? 1;

  if (exitCode === 0) {
    persistActiveEnvMode();
  }
} catch (error) {
  console.error('[start.mjs] Error while starting Expo:', error);
  exitCode = 1;
}

process.exit(exitCode);
