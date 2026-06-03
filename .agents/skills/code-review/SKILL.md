---
# SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
#
# SPDX-License-Identifier: AGPL-3.0-or-later

name: code-review
description: Review code or a diff for correctness, style, and project conventions. Use when asked to review, audit, or check a PR or function.
---

# Code Review

Produce a structured review. Check the following, in order:

## 1. Correctness

- Logic errors, off-by-ones, unhandled async/await, missing error boundaries
- Any API calls that will fail on web vs. native (check `Platform.OS` guards)

## 2. Type safety

- Flag anything that looks like an implicit `any`, missing nullcheck, or type assertion that could hide a bug
- If the diff touches shared types, check all call sites are updated

## 3. Tests

- Is there a Jest test for new logic? If not, note it.
- Existing tests still pass with the change? Flag if coverage drops on a non-trivial path.

## 4. Lint / style

- ESLint rules for this project: check for unused imports, missing deps in `useEffect`, and React hooks rule violations
- Consistent naming: components PascalCase, hooks `use` prefix, utils camelCase

## 5. React Native / Expo specifics

- No `div`/`span` — must use RN primitives
- Styles via StyleSheet.create or a project-approved library, not inline objects in render
- Any new native module or permission? Note it needs EAS build, not just Expo Go

## 6. Architecture and conventions

- Code files should be focused and small. If a file exceeds ~300 lines, consider splitting it. A common pattern is creating a sub-component. For large monolithic components, create a logic helper and a view helper, with the main component acting as the controller.
- Use KISS principle: if a simpler solution exists, prefer it over a more complex one, even if the complex one is more "elegant" or "abstract." The best code is no code.

## Output format

Use severity labels: **must fix**, **consider**, **looks good**.
One section per category above. Skip empty sections.