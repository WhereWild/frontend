#!/usr/bin/env node

// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';

const args = process.argv.slice(2);
const requestedAppVariant = process.env.APP_VARIANT;
const defaultAppVariant = 'production';

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

let exitCode = 1;

try {
  let env = { ...process.env };
  const dotenvPath = '.env';

  if (existsSync(dotenvPath)) {
    env = {
      ...parse(readFileSync(dotenvPath)),
      ...process.env,
    };
  }

  env.EXPO_NO_DOTENV = '1';

  if (!requestedAppVariant) {
    env.APP_VARIANT = defaultAppVariant;
  }

  // A CLI backend URL always wins over the loaded .env value.
  if (backendUrl) {
    env.APP_BACKEND_URL = backendUrl;
  }

  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'expo',
      'export',
      '-c',
      '--platform',
      'web',
      '--output-dir=dist',
      ...passThroughArgs,
    ],
    { stdio: 'inherit', shell: false, env }
  );

  exitCode = result.status ?? 1;
} catch (error) {
  console.error('[export-web.mjs] Error while exporting:', error);
  exitCode = 1;
}

process.exit(exitCode);
