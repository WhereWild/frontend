---
name: test-with-jest
description: Run Jest tests using the VS Code Jest extension test runner. Use when testing and after making code changes.
---

# Running tests via the VS Code Jest extension

Prefer the Jest extension over running `jest` in the terminal directly.

## How to trigger runs

- Run all tests: use the integrated test runner.
- Run a file or single test: try the integrated test runner first, but if discovery fails, use terminal Jest instead
- Watch mode: use the Jest extension watch mode when you want automatic reruns on save

## When to use the terminal instead

- CI parity check: `npx jest --ci` to match what the pipeline runs
- Coverage: `npx jest --coverage` (extension doesn't show coverage inline by default)
- Filtering by name: `npx jest -t "test name pattern"`
- File-targeted runs if the integrated runner says `No tests found in the files`

## Notes for WhereWild

- Tests live in `__tests__/` directories co-located with source, or in `src/**/*.test.ts(x)`
- The Jest config uses `jest.config.js` at root — confirm the extension is pointed at it if tests fail to discover
- Expo preset is configured; don't add `transform` overrides without checking the preset first