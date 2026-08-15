#!/usr/bin/env node

// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Ad hoc scaffolding for one variable guide at a time — run
// `npm run scaffold:variable-guide -- <slug>` with the backend dev server
// running. Creates content/guides/variables/<slug>.md with a heading per
// legend class (for categorical variables) if it doesn't exist yet; if it
// already exists, only appends sections for classes the file doesn't have a
// "## " heading for yet — never touches content you've already written.
//
// Intentionally not run automatically for every variable — some legends
// (ecoregions: 847 classes) aren't meant to get per-class descriptions, so
// scaffolding is opt-in per slug.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/scaffold-variable-guide.mjs <slug>');
  process.exit(1);
}

const BACKEND_BASE = process.env.APP_BACKEND_URL || 'http://localhost:8000';

// Mirrors components/sections/speciesEnvironment/temporalHelpers.ts +
// model.ts's getVariableFamilyKey/pickFamilyRepresentative/getFamilyLabel —
// duplicated here in plain JS since this script runs outside the Expo/TS
// bundler and shouldn't need a TS toolchain of its own.
const TEMPORAL_PATTERN = /^(.+)_(avg|sum|mode|snapshot)_(\d+)h$/i;

function parseTemporalId(id) {
  const match = id.match(TEMPORAL_PATTERN);
  if (!match) return null;
  return { baseId: match[1], agg: match[2], windowHours: parseInt(match[3], 10) };
}

function getVariableFamilyKey(variable) {
  const parsed = parseTemporalId(variable.id);
  if (parsed) return parsed.baseId;
  if (variable.group && variable.agg) return variable.group;
  return variable.id;
}

function pickFamilyRepresentative(variants) {
  const meanVariant = variants.find((v) => v.agg === 'mean');
  if (meanVariant) return meanVariant;
  const shortestWindow = variants
    .map((v) => ({ v, parsed: parseTemporalId(v.id) }))
    .filter((entry) => entry.parsed !== null)
    .sort((a, b) => a.parsed.windowHours - b.parsed.windowHours)[0];
  return shortestWindow?.v ?? variants[0];
}

function stripTemporalSuffix(label) {
  return label.replace(/\s*\((avg|sum|mode|snapshot),\s*\d+h\)\s*$/i, '').trim();
}

function getFamilyLabel(representative, familyKey) {
  if (parseTemporalId(representative.id)) {
    return stripTemporalSuffix(representative.name ?? familyKey);
  }
  if (representative.group && representative.agg) {
    return representative.group_label ?? representative.name ?? familyKey;
  }
  return representative.name ?? familyKey;
}

const response = await fetch(`${BACKEND_BASE}/variables`);
if (!response.ok) {
  console.error(
    `[scaffold-variable-guide] Failed to fetch ${BACKEND_BASE}/variables: ${response.status} ${response.statusText}`,
  );
  process.exit(1);
}
const variables = await response.json();

const families = new Map();
for (const variable of variables) {
  const key = getVariableFamilyKey(variable);
  const existing = families.get(key) ?? [];
  existing.push(variable);
  families.set(key, existing);
}

const variants = families.get(slug);
if (!variants) {
  console.error(`[scaffold-variable-guide] No variable family found for "${slug}".`);
  process.exit(1);
}

const representative = pickFamilyRepresentative(variants);
const label = getFamilyLabel(representative, slug);
const legendClasses =
  representative.legend_classes ?? representative.legendClasses ?? [];

const filePath = join(
  process.cwd(),
  'content',
  'guides',
  'variables',
  `${slug}.md`,
);

if (!existsSync(filePath)) {
  const classSections = legendClasses
    .map((cls) => `## ${cls.name}\n`)
    .join('\n');
  const content = `# ${label}\n\n<!-- Write the variable's description here. -->\n\n${classSections}`;
  writeFileSync(filePath, content);
  console.log(
    `[scaffold-variable-guide] Created ${filePath} with ${legendClasses.length} class section(s).`,
  );
} else {
  const existingContent = readFileSync(filePath, 'utf8');
  const existingHeadings = new Set(
    [...existingContent.matchAll(/^##\s+(.+)$/gm)].map((match) =>
      match[1].trim(),
    ),
  );
  const missing = legendClasses.filter(
    (cls) => !existingHeadings.has(cls.name),
  );

  if (missing.length === 0) {
    console.log(
      `[scaffold-variable-guide] ${filePath} already covers all ${legendClasses.length} known class(es).`,
    );
  } else {
    const appended = missing
      .map((cls) => `## ${cls.name}\n<!-- new class, needs a description -->\n`)
      .join('\n');
    writeFileSync(filePath, `${existingContent.trimEnd()}\n\n${appended}`);
    console.log(
      `[scaffold-variable-guide] Appended ${missing.length} missing class section(s) to ${filePath}: ${missing
        .map((cls) => cls.name)
        .join(', ')}`,
    );
  }
}

spawnSync('node', ['./scripts/generate-variable-guides-index.mjs'], {
  stdio: 'inherit',
});
