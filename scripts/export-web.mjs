#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';

const args = process.argv.slice(2);

const passThroughArgs = [];
let backendUrl;
let sawBackendFlag = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg.startsWith('--backendUrl=')) {
    sawBackendFlag = true;
    backendUrl = arg.slice('--backendUrl='.length);
    continue;
  }
  if (arg === '--backendUrl') {
    sawBackendFlag = true;
    backendUrl = args[i + 1];
    i += 1;
    continue;
  }
  passThroughArgs.push(arg);
}

if (sawBackendFlag && (!backendUrl || backendUrl.startsWith('--'))) {
  console.error(
    'Missing value for --backendUrl. Use --backendUrl=http://host:port or --backendUrl http://host:port.'
  );
  process.exit(1);
}

// Move .env.local so export uses prod .env or the CLI override.
const localEnvPath = '.env.local';
const localEnvBackupPath = '.env.local.bak.export';
const hasLocalEnv = existsSync(localEnvPath);
let renamedLocalEnv = false;
let exitCode = 1;

try {
  if (hasLocalEnv) {
    // Avoid overwriting an existing backup, which may indicate a previous failed run.
    if (existsSync(localEnvBackupPath)) {
      console.error(
        `Refusing to rename "${localEnvPath}" because "${localEnvBackupPath}" already exists. ` +
          'Please resolve this conflict (e.g., restore or remove the backup file) and try again.'
      );
      throw new Error(`Backup file "${localEnvBackupPath}" already exists`);
    }

    renameSync(localEnvPath, localEnvBackupPath);
    renamedLocalEnv = true;
  }

  const env = { ...process.env };

  // If a CLI backend URL is provided, skip dotenv entirely and use that value.
  if (backendUrl) {
    env.EXPO_PUBLIC_BACKEND_URL = backendUrl;
    env.EXPO_NO_DOTENV = '1';
  }

  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'expo',
      'export',
      `-c`,
      '--platform',
      'web',
      '--output-dir=dist',
      ...passThroughArgs,
    ],
    { stdio: 'inherit', shell: false, env }
  );

  exitCode = result.status ?? 1;
} finally {
  if (renamedLocalEnv && existsSync(localEnvBackupPath)) {
    try {
      renameSync(localEnvBackupPath, localEnvPath);
    } catch (error) {
      console.error(
        `Failed to restore "${localEnvPath}" from backup "${localEnvBackupPath}". ` +
          'Please restore the file manually.',
        error
      );
      if (exitCode === 0) {
        exitCode = 1;
      }
    }
  }
}

process.exit(exitCode);
