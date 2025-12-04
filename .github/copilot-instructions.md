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
- `npm test -- <pattern>` – targeted Jest suites

## Design Tokens and Text
- Import tokens only from `constants/theme.ts`. Never read from `wdsTokens.ts` directly; it contains raw auto-generated tokens not structured for component use. Always use `constants/theme.ts` to ensure tokens are properly structured and theme-aware for components.
- Always render copy with `ThemedText`; plain `<Text>` is reserved for that component alone.
- Index `Size` tokens with strings (`Size.space['400']`).
- Keep overrides minimal. Prefer wrapping layout containers over restyling shared components.

Example:
```tsx
const scheme = useColorScheme();
const mode = scheme === 'dark' ? 'dark' : 'light';

<View style={{
  backgroundColor: Colors[mode].background.brand.default,
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
5. Keep features simple (KISS) and avoid speculative abstractions
6. Write TypeScript-friendly props, exporting types when helpful
7. Test on iOS, Android, and web when practical

## Code Clarity and Data Keys
- Avoid redundant indirection, wrappers that only forward props, or helper chains that hide simple logic.
- In WhereWild, `taxonId` is the canonical unique identifier for a species, typically sourced from standardized taxonomy databases (e.g., GBIF, ITIS). All species and environment dictionaries should be keyed or indexed by `taxonId` to ensure consistency and interoperability across the codebase. For more details, see the data model documentation in `data/types/species.ts` or the project wiki.
- Always key or index species/environment dictionaries by `taxonId`. Do not invent alternate keys.
- Refactors intended to simplify code should stay incremental; do not replace entire files without cause.

## Architecture and Naming
- Components use PascalCase (`Button.tsx`), hooks camelCase (`useColorScheme.ts`), constants kebab-case (`theme.ts`).
- Barrel exports live in `components/index.ts` for clean imports.
- Directory highlights: `app/` (screens), `components/` (UI), `constants/` (tokens), `hooks/`, `data/`, `scripts/`.

## Component Patterns
### Buttons
```
<Button variant="primary" size="medium" onPress={handleSubmit}>Submit</Button>
<ButtonDanger variant="primary" size="small">Delete</ButtonDanger>
```
All button variants support loading, disabled, and optional icons.

### Text
Use `ThemedText` variants (`body`, `bodyStrong`, `heading`, `bodySmall`, etc.) instead of custom styles. Add a new variant only if none of the existing options fit.

### Layout
Compose spacing with `Size` tokens and `StyleSheet`. Favor stacking `View`s to control layout rather than overriding shared component styles.

## React Native vs Web Reference
- `<div>` → `<View>`
- `<button>` → `<Pressable>` / `<TouchableOpacity>`
- `<img>` → `<Image>`
- CSS files → `StyleSheet`
- `className` → `style`

### Design to Code Workflow
1. Call `mcp_figma_mcp-ser_get_design_context` for the specific node** (requires `fileKey` + `nodeId`). This is the main tool for extracting detailed design data for a selected node.
2. Handling large payloads: If the response from `get_design_context` is very large (e.g., over 1MB, contains thousands of nodes, or you receive a truncation warning/error), do not attempt to process the full payload. Instead:
   - First, call `mcp_figma_mcp-ser_get_metadata` for the file or node. This returns a lightweight summary of the structure and key properties, allowing you to identify which parts of the design are relevant.
   - Use the metadata to narrow your selection (e.g., focus on a specific frame, component, or node group) and then call `get_design_context` again with the more specific nodeId(s).
   - If you receive a truncated response (e.g., missing children, explicit truncation flag, or incomplete data), always reduce the scope of your request. You may need to recursively fetch context for child nodes individually.
   - As a rule of thumb, "huge" means any response that is truncated, takes more than a few seconds to return, or contains more than 500 nodes. If in doubt, prefer metadata-first.
3. Retrieve a screenshot with `mcp_figma_mcp-ser_get_screenshot` for visual reference. This helps you verify the visual output and compare it to your implementation.
4. Pull variable definitions via `mcp_figma_mcp-ser_get_variable_defs` when token values are unclear or missing from the context response.
5. Translate resulting HTML/Tailwind into React Native, swapping in WDS tokens and shared components. Always use the design system tokens and primitives.
6. Handle both themes and respect existing navigation/state patterns. Ensure your implementation works in both light and dark modes.
7. Compare the final UI with the screenshot before considering the task complete. This ensures visual fidelity and correctness.

## Testing Expectations
- Line or branch coverage alone proves nothing. Reject tests that simply call functions, assert `true`, or check `typeof` without validating behavior.
- Watch for branch “cheats” (same inputs hitting identical code paths, mocks that skip logic, catch blocks that swallow errors) and for snapshot-only suites that never assert intent.
- Insist on concrete assertions per branch: cover nominal, error, edge, and boundary cases separately; forbid vacuous expectations or calls “just for coverage.”
- Demand realistic mocks and, when in doubt, ask for a branch map explaining how each conditional is exercised—this exposes untested logic immediately.
- In short: prefer fewer, meaningful tests over inflated 100% coverage claims generated by LLMs.

## Common Pitfalls
- Importing from `wdsTokens.ts` or raw CSS variables.
- Using web-only elements or CSS files.
- Hardcoding colors/spacing instead of tokens.
- Ignoring color modes.
- Overriding `ThemedText` colors instead of picking a variant.
- Storing species data with keys other than `taxonId`.
