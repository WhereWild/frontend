#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';

const passThroughArgs = process.argv.slice(2);

const env = { ...process.env };
// If start:prod sets EXPO_DOTENV=.env, temporarily move .env.local out of the way.
const localEnvPath = '.env.local';
const localEnvBackupPath = '.env.local.bak.start';
const shouldMoveLocalEnv = env.EXPO_DOTENV === '.env';
const hasLocalEnv = shouldMoveLocalEnv && existsSync(localEnvPath);

let exitCode = 1;
let didBackup = false;

try {
  if (hasLocalEnv) {
    if (existsSync(localEnvBackupPath)) {
      console.error(
        '[start.mjs] Refusing to start: backup .env.local.bak already exists. ' +
          'Please resolve this manually before running the script again.'
      );
      // Skip starting Expo; exitCode remains non-zero.
    } else {
      renameSync(localEnvPath, localEnvBackupPath);
      didBackup = true;
    }
  }

  console.log('[start.mjs] EXPO_DOTENV:', env.EXPO_DOTENV ?? '(unset)');

  // Only attempt to start Expo if we didn't abort due to an existing backup.
  if (!hasLocalEnv || didBackup) {
    // Pass through any args (like -c) to Expo without custom env overrides.
    const result = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['expo', 'start', ...passThroughArgs],
      { stdio: 'inherit', shell: false, env }
    );

    exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error('[start.mjs] Error while starting Expo:', error);
  exitCode = 1;
} finally {
  if (didBackup && existsSync(localEnvBackupPath)) {
    try {
      renameSync(localEnvBackupPath, localEnvPath);
    } catch (restoreError) {
      console.error(
        '[start.mjs] Failed to restore .env.local from backup:',
        restoreError
      );
      exitCode = 1;
    }
  }
}

process.exit(exitCode);
