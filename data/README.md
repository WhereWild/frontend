# Data Interfaces

The UI screens consume strongly typed data objects so they can be wired to any API source (mock data, REST/GraphQL, etc.). The canonical typings live in [`data/types.ts`](./types.ts).

| Interface | Purpose | Key Fields |
| --- | --- | --- |
| `HomePageData` | Drives the home screen map snapshot and recommendation shelf. | `map` (heatmap + controls images), `recommendations.items` (array of `SpeciesSummary`). |
| `SpeciesPageData` | Powers the species detail sample page, including overview text, nearby species, and the predictive heatmap. | `overview`, `nearbySpecies`, `heatmap`. |
| `SpeciesSummary` | Lightweight representation of a species suitable for cards and lists. | `commonName`, `scientificName`, `description`, optional `imageSource`. |

When replacing the mock data with a FastAPI (or any REST) backend, shape your responses to match these interfaces and pass them directly into the existing pages. Doing so keeps the UI completely declarative: fetch data → hydrate the relevant interface → render.

## Data Layer Boundaries

Use these module boundaries when adding or changing data logic:

- `api.ts`: Public facade for app consumers; keeps stable exported function names used by hooks/components; delegates to focused helper modules.
- `apiShared.ts`: Shared low-level API request/coercion helpers (`BACKEND_BASE`, `fetchJsonOrThrow`, basic coercers); no endpoint-specific business logic.
- `apiSpeciesSearchHelpers.ts`: Species search/list request + normalization logic.
- `apiVariableHelpers.ts`: Environmental variable list endpoint logic.
- `apiRankingHelpers.ts`: Relative ranking/options endpoint logic and payload normalization.
- `apiLocationHelpers.ts`: Location search/species-location endpoint logic and location row normalization.
- `apiEnvironmentHelpers.ts`: Environment stats/slice/category-samples/occurrences endpoint logic.
- `environmentParsers.ts`: Compatibility export surface for environment parsing functions; re-exports from parser submodules to keep imports stable for callers.
- `parsers/core.ts`: Shared parser primitives (`asRecord`, `getArray`, optional string coercion).
- `parsers/environment/definitions.ts`: Parsing environment variable metadata payloads.
- `parsers/environment/responses.ts`: Parsing environment stats/slice/sample responses.
- `speciesDetailParser.ts`: Detail payload shaping only (description/meta fields), delegates overview section parsing.
- `speciesOverviewParser.ts`: Overview section/line normalization from structured profile or plain description text.

## Placement Rules

- Add new endpoint request code to the nearest `api*Helpers.ts` module by domain.
- Keep `api.ts` as orchestration and public API surface; avoid re-introducing large inline parsers there.
- Add new payload parsing logic under `parsers/` and re-export via compatibility files when needed.
- Prefer extending existing domain helpers over creating generic catch-all utility files.

## Stability Contract

- Treat `api.ts` exports and `types.ts` contracts as the app-facing interface.
- Internal helper file names can evolve, but changing `api.ts` signatures should be deliberate and coordinated with consuming hooks/components.
