<!--
SPDX-FileCopyrightText: 2024 Figma
SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)

SPDX-License-Identifier: MIT
-->

# WhereWild Theme Sync Assets

This directory contains the Figma export plugins, token/style snapshot files,
and the processing scripts needed to regenerate the app theme without checking
out the separate design-system repository.

## Files

- `app.mjs` converts `tokens.json` and `styles.json` into `constants/wds-theme.css`
- `fromFigma.mjs` fetches token/style data from the Figma REST API when credentials are available
- `tokens.json` is the latest committed token snapshot
- `styles.json` is the latest committed style snapshot
- `figma-plugin-token-json/` exports local variable collections from Figma into JSON
- `figma-plugin-styles-json/` exports local text, paint, and effect styles from Figma into JSON

## Common flows

Offline or plugin-based regeneration:

```bash
npm run sync-theme
```

REST-backed refresh plus regeneration:

```bash
FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... npm run sync-theme:rest
```

## Updating snapshots with the plugins

1. Import `manifest.json` from `figma-plugin-token-json/` into a local Figma development plugin.
2. Run the plugin in the design file and copy the JSON output into `tokens.json`.
3. Import `manifest.json` from `figma-plugin-styles-json/` into a local Figma development plugin.
4. Run the plugin in the design file and copy the JSON output into `styles.json`.
5. Run `npm run sync-theme`.
