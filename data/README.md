# Data Interfaces

The UI screens consume strongly typed data objects so they can be wired to any API source (mock data, REST/GraphQL, etc.). The canonical typings live in [`data/types.ts`](./types.ts).

| Interface | Purpose | Key Fields |
| --- | --- | --- |
| `HomePageData` | Drives the home screen map snapshot and recommendation shelf. | `map` (heatmap + controls images), `recommendations.items` (array of `SpeciesSummary`). |
| `SpeciesPageData` | Powers the species detail sample page, including overview text, nearby species, and the predictive heatmap. | `overview`, `nearbySpecies`, `heatmap`. |
| `SpeciesSummary` | Lightweight representation of a species suitable for cards and lists. | `commonName`, `scientificName`, `description`, optional `imageSource`. |

When replacing the mock data with a FastAPI (or any REST) backend, shape your responses to match these interfaces and pass them directly into the existing pages. Doing so keeps the UI completely declarative: fetch data → hydrate the relevant interface → render.
