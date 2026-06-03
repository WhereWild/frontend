// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import fs from 'node:fs';
import path from 'node:path';

// Heuristic static audit for React Native Fabric host-tree churn risks.
// This does not prove a crash, but it surfaces recurring patterns that have
// correlated with "unmount a view which has a different index" failures.

const repoRoot = process.cwd();
const includeRoots = ['app', 'components', 'context', 'hooks', 'primitives', 'utils'];
const includeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const ignoredDirNames = new Set(['__tests__', 'coverage', 'node_modules', '.expo', '.git']);

// Each rule targets a broad code shape that can destabilize native child order
// during interaction updates, portal teardown, or app reload/suspend.
const rules = [
  {
    id: 'pressable-style-callback',
    description: 'Pressable style callback can churn native interaction hosts on Fabric.',
    test: (source) => findPressableStyleCallbackMatches(source),
  },
  {
    id: 'pressable-children-function',
    description: 'Pressable render-prop children can reshuffle native children during interaction updates.',
    test: (source) => findPressableChildrenFunctionMatches(source),
  },
  {
    id: 'deferred-transition',
    description: 'setTimeout/requestAnimationFrame plus React.startTransition can race teardown/reload.',
    test: (source) => findDeferredTransitionMatches(source),
  },
  {
    id: 'conditional-portal-mount',
    description: 'Conditionally mounting Portal trees can destabilize teardown-sensitive native hosts.',
    test: (source) => findAllMatches(source, /\?\s*\(\s*<Portal\b|\bvisible\s*&&\s*<Portal\b/g),
  },
  {
    id: 'conditional-host-null',
    description: 'Conditional host mounting near native interactions can cause sibling index churn.',
    test: (source) => findConditionalHostMatches(source),
  },
];

// Walk only source directories that can contain runtime UI code.
function walk(dirPath, results) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirNames.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
      continue;
    }

    if (!includeExtensions.has(path.extname(entry.name))) {
      continue;
    }

    results.push(fullPath);
  }
}

// Convert absolute paths to stable repo-relative output for the audit report.
function toRelativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

// Report 1-based line numbers for easier navigation from terminal output.
function getLineNumber(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) {
      line += 1;
    }
  }
  return line;
}

// Include the triggering source line to make the audit actionable without
// needing to open every file first.
function getLineText(source, index) {
  const start = source.lastIndexOf('\n', index - 1) + 1;
  const end = source.indexOf('\n', index);
  return source.slice(start, end === -1 ? source.length : end).trim();
}

// Generic regex collector used by most heuristic rules.
function findAllMatches(source, regex) {
  const matches = [];
  for (const match of source.matchAll(regex)) {
    if (typeof match.index !== 'number') {
      continue;
    }
    matches.push({ index: match.index, snippet: getLineText(source, match.index) });
  }
  return matches;
}

function hasNearbyPressableTag(source, index) {
  const searchWindow = source.slice(Math.max(0, index - 1200), index);
  const openTagRegex = /<(?:Pressable|[A-Z][A-Za-z0-9_.]*Pressable[A-Za-z0-9_.]*)/g;
  const openTagMatches = [...searchWindow.matchAll(openTagRegex)];
  if (openTagMatches.length === 0) {
    return false;
  }

  const lastOpenTag = openTagMatches[openTagMatches.length - 1];
  const openTagOffset = typeof lastOpenTag.index === 'number' ? lastOpenTag.index : -1;
  if (openTagOffset === -1) {
    return false;
  }

  const trailingSource = searchWindow.slice(openTagOffset);
  return !trailingSource.includes('</');
}

function findPressableStyleCallbackMatches(source) {
  const matches = [];
  const callbackRegex = /\bstyle=\{\s*\((?:state|\{[^)]*pressed[^)]*\}|[^)]*pressed[^)]*)/g;

  for (const match of source.matchAll(callbackRegex)) {
    if (typeof match.index !== 'number') {
      continue;
    }

    if (!hasNearbyPressableTag(source, match.index)) {
      continue;
    }

    matches.push({ index: match.index, snippet: getLineText(source, match.index) });
  }

  return matches;
}

function findPressableChildrenFunctionMatches(source) {
  const matches = [];
  const callbackRegex = />\s*\{\s*\((?:state|\{[^)]*pressed[^)]*\}|[^)]*pressed[^)]*)/g;

  for (const match of source.matchAll(callbackRegex)) {
    if (typeof match.index !== 'number') {
      continue;
    }

    const callbackOffset = match[0].indexOf('{');
    const callbackIndex = callbackOffset === -1 ? match.index : match.index + callbackOffset;
    if (!hasNearbyPressableTag(source, callbackIndex)) {
      continue;
    }

    matches.push({ index: callbackIndex, snippet: getLineText(source, callbackIndex) });
  }

  return matches;
}

// Timed transitions are especially suspicious when reload/suspend can race the
// scheduled callback after a user interaction.
function findDeferredTransitionMatches(source) {
  const matches = [];
  const triggerRegex = /setTimeout\(|requestAnimationFrame\(/g;
  for (const match of source.matchAll(triggerRegex)) {
    if (typeof match.index !== 'number') {
      continue;
    }
    const window = source.slice(match.index, match.index + 400);
    if (!window.includes('startTransition')) {
      continue;
    }
    matches.push({ index: match.index, snippet: getLineText(source, match.index) });
  }
  return matches;
}

// Conditional host mounting is noisy in general, so narrow it to windows that
// also mention interactive or teardown-sensitive primitives.
function findConditionalHostMatches(source) {
  const matches = [];
  const conditionalRegex = /\?\s*\(\s*<(?:View|Pressable|ScrollView|Portal|Tabs|NavigationPillList|SelectField)\b|\bvisible\s*&&\s*<(?:View|Pressable|ScrollView|Portal|Tabs|NavigationPillList|SelectField)\b/g;
  for (const match of source.matchAll(conditionalRegex)) {
    if (typeof match.index !== 'number') {
      continue;
    }

    const windowStart = Math.max(0, match.index - 200);
    const windowEnd = Math.min(source.length, match.index + 300);
    const window = source.slice(windowStart, windowEnd);
    if (!/Pressable|ScrollView|Portal|NavigationPillList|Tabs|SelectField|onPress|onResponder|onSelectionChange/.test(window)) {
      continue;
    }

    matches.push({ index: match.index, snippet: getLineText(source, match.index) });
  }
  return matches;
}

const files = [];
for (const includeRoot of includeRoots) {
  const fullRoot = path.join(repoRoot, includeRoot);
  if (fs.existsSync(fullRoot)) {
    walk(fullRoot, files);
  }
}

const findings = [];

// Run every rule against every candidate file and collect normalized findings.
for (const filePath of files) {
  const source = fs.readFileSync(filePath, 'utf8');
  for (const rule of rules) {
    const matches = rule.test(source);
    for (const match of matches) {
      findings.push({
        filePath: toRelativePath(filePath),
        line: getLineNumber(source, match.index),
        ruleId: rule.id,
        description: rule.description,
        snippet: match.snippet,
      });
    }
  }
}

findings.sort((left, right) => {
  if (left.filePath !== right.filePath) {
    return left.filePath.localeCompare(right.filePath);
  }
  if (left.line !== right.line) {
    return left.line - right.line;
  }
  return left.ruleId.localeCompare(right.ruleId);
});

if (findings.length === 0) {
  console.log('No Fabric risk heuristics matched.');
  process.exit(0);
}

// Emit a compact terminal report that can be pasted into follow-up triage work.
console.log(`Fabric risk audit found ${findings.length} potential issues.\n`);

for (const finding of findings) {
  console.log(`${finding.filePath}:${finding.line}  [${finding.ruleId}] ${finding.description}`);
  if (finding.snippet) {
    console.log(`  ${finding.snippet}`);
  }
}