<!--
SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)

SPDX-License-Identifier: AGPL-3.0-or-later
-->

# WhereWild Front-End Copilot Instructions

## Overview

WhereWild is an Expo React Native app for naturalists to explore species data, environmental factors, and predicted heatmaps. The UI mirrors the WhereWild Design System (WDS) so tokens, typography, and reusable components stay in sync across platforms.

Key capabilities:

- Aggregate species data with environmental summaries and nearby-species suggestions.
- Live heatmap imagery with placeholder fallbacks when predictions are pending.
- Inline graphs that visualize environmental distributions per species.

## Tech Stack

- Expo + React Native (TypeScript)
- WhereWild Design System tokens synced via `constants/theme.ts`
- Light and dark mode detection through `useColorScheme`
- Jest + React Testing Library for unit tests

## Core Commands

- `npm start` – Expo dev server
- `npm run android | ios | web` – platform targets
- `npm run sync-theme` – pull latest design tokens
- `npm run lint` – Expo lint rules
- `npm run typecheck` – TypeScript type checking
- `npm run test:coverage` – Jest with coverage report

## Design Tokens and Text

- Import tokens only from `constants/theme.ts`. Never read from `wdsTokens.ts` directly; it contains raw auto-generated tokens not structured for component use. Always use `constants/theme.ts` to ensure tokens are properly structured and theme-aware for components.
- Always render text with `ThemedText`; plain `<Text>` is reserved for that component alone.
- Index `Size` tokens with strings (`Size.space['400']`).
- Components that toggle borders across states must always define `borderWidth` and do not override it across states. Use `borderColor: 'transparent'` for states without a visible border (or when border color matches the background). Reference `Button` and `NavigationPill` for implementation.
- Pressable components should have pressed and hover states.
- Circular components should use `Size.radius['full']` for the border radius instead of the radius of the component.
- Keep style overrides minimal. Prefer wrapping layout containers over restyling shared components.
    - Overriding the style of `ThemedText` should be used for edge-case UI states (for example, one-off disabled, error, or secondary text treatments that are not yet covered by existing variants). If you need the same override outside the context of a UI component, stop and ask the design team to define a new `ThemedText` variant instead.

Example:

```tsx
const scheme = useColorScheme();
const mode = scheme === 'dark' ? 'dark' : 'light';
const palette = Colors[mode];

<View style={{
  backgroundColor: palette.background.brand.default,
  padding: Size.space['400'],
  borderRadius: Size.radius['200'],
}}>
  <ThemedText variant="body">Content</ThemedText>
</View>
```

## Implementation Checklist

1. Use React Native primitives (`View`, `Pressable`, etc.)
2. Style via `StyleSheet.create` or inline objects
3. Wire color mode logic with `useColorScheme`
4. Reuse shared components from `@/components`
5. Keep features simple (KISS) and avoid speculative abstractions. The best code is no code.
6. Write TypeScript-friendly props, exporting types when helpful
7. Write comprehensive unit tests that satisfy coverage goals
8. Verify linting and typechecking passes

## Code Clarity and Data Keys

- Avoid redundant indirection, wrappers that only forward props, or helper chains that hide simple logic.
- Keep functions and files focused and small. If a file exceeds ~300 lines, consider splitting it. A common pattern is creating a sub-component. For large monolithic components, create a logic helper and a view helper, with the main component acting as the controller.
- In WhereWild, `taxonId` is the canonical unique identifier for a species, typically sourced from standardized taxonomy databases. All species and environment dictionaries should be keyed or indexed by `taxonId` to ensure consistency and interoperability across the codebase. For more details, see the data model documentation in `data/types.ts`.
- Always key or index species/environment dictionaries by `taxonId`. Do not invent alternate keys.
- Refactors intended to simplify code should stay incremental; do not replace entire files without cause.
- Keep code smell low: if a comment is required to explain a block of code to a junior developer, consider refactoring that block for clarity instead. Comments should explain "why" not "what" or "how."

## Architecture and Naming

- Components use PascalCase (`Button.tsx`), hooks camelCase (`useColorScheme.ts`), constants lowercase simple filenames (`theme.ts`).
- Barrel exports live in `components/index.tsx` for clean imports.
- Directory highlights: `app/` (screens), `components/` (UI), `constants/` (tokens), `hooks/`, `data/`, `scripts/`.

## Component Patterns

### Buttons

```tsx
<Button variant="primary" size="medium" onPress={handleSubmit}>Submit</Button>
<ButtonDanger variant="primary" size="small">Delete</ButtonDanger>
```

All button variants support loading, disabled, and optional icons.

### Layout

Compose spacing with `Size` tokens and `StyleSheet`. Favor stacking `View`s to control layout rather than overriding shared component styles.

## React Native vs Web

- `<div>` → `<View>`
- `<button>` → `<Pressable>` / `<TouchableOpacity>`
- `<img>` → `<Image>`
- CSS files → `StyleSheet`
- `className` → `style`
- For components shown on non-native targets (for example web), do not require the native animation driver; gate `useNativeDriver` with platform checks and fall back to JS driver when needed.

## Figma MCP Integration Rules

These rules define how to translate Figma inputs into code for this project and must be followed for every Figma-driven change.

### Required flow (do not skip)

1. Run `get_design_context` first to fetch the structured representation for the exact node(s).
2. If the response is too large or truncated, run `get_metadata` to get the high‑level node map and then re‑fetch only the required node(s) with `get_design_context`.
3. Run `get_screenshot` for a visual reference of the node variant being implemented.
4. Only after you have both `get_design_context` and `get_screenshot`, download any assets needed and start implementation.
5. Translate the output (usually React + Tailwind) into this project's conventions, styles and framework. Reuse the project's color tokens, components, and typography wherever possible.
6. Validate against Figma for 1:1 look and behavior before marking complete.

### Implementation rules

- Treat the Figma MCP output (React + Tailwind) as a representation of design and behavior, not as final code style.
- Replace Tailwind utility classes with the project's preferred utilities/design‑system tokens when applicable.
- Reuse existing components (e.g., buttons, inputs, typography, icon wrappers) instead of duplicating functionality.
- Use the project's color system, typography scale, and spacing tokens consistently.
- Respect existing routing, state management, and data‑fetch patterns already adopted in the repo.
- Strive for 1:1 visual parity with the Figma design. When conflicts arise, prefer design‑system tokens and adjust spacing or sizes minimally to match visuals.
- Validate the final UI against the Figma screenshot for both look and behavior.

## Testing Expectations

- Line or branch coverage alone proves nothing. Reject tests that simply call functions, assert `true`, or check `typeof` without validating behavior.
- Watch for branch “cheats” (same inputs hitting identical code paths, mocks that skip logic, catch blocks that swallow errors) and for snapshot-only suites that never assert intent.
- Insist on concrete assertions per branch: cover nominal, error, edge, and boundary cases separately; forbid vacuous expectations or calls “just for coverage.”
- Demand realistic mocks and, when in doubt, ask for a branch map explaining how each conditional is exercised—this exposes untested logic immediately.
- Reach coverage expectations with `npm run test:coverage` or targeted tests with coverage for a specific component.
- In short: prefer fewer, meaningful tests over inflated 100% coverage claims generated by LLMs.

## Common Pitfalls

- Importing from `wdsTokens.ts` or raw CSS variables.
- Using web-only elements or CSS files.
- Hardcoding colors/spacing instead of tokens.
- Ignoring color modes.
- Overriding `ThemedText` colors instead of asking for a variant outside of dedicated UI components.
- Storing species data with keys other than `taxonId`.
- Overcomplicating components with unnecessary abstractions, indirection, and guards.
- Large components that could be split into focused sub-components or logic helpers.
- Use of `pointerEvents="none"`. `props.pointerEvents` is deprecated. Use `style.pointerEvent`.
- Fabric view-index crashes on iPadOS: The root issue is unstable native host-tree shape under Fabric during rapid updates, especially hover, press, portal teardown, and navigation. Avoid adding, removing, or reordering native children inside `Pressable`, `ScrollView`, and similar containers. Prefer a stable `<View collapsable={false}>` wrapper and hide content with styles instead of conditional mounting; for `Pressable` children-as-function, return one wrapper `<View>`, not a Fragment. Fabric stability rules:
    - Conditional rendering is still fine for ordinary static layout changes, especially away from active gestures, hover state, scrolling containers, and portal lifecycles.
    - Treat this as a platform rule, not just a bug workaround: web-style structural churn that is usually harmless in the DOM can cause responder, measurement, or view-index problems in React Native Fabric.
