    // No separate offline-only AttributionControl here — the Natural Earth/
    // GeoNames credits live on the offlineFallback/offlinePlaceLabels
    // sources' own `attribution` field instead (see
    // globeOfflineSourcesFragment.partial.js), so the single
    // AttributionControl the main template already adds picks them up
    // automatically. A second, always-on control here used to duplicate
    // that (two visible attribution widgets at once) once the main
    // control's own TILE_ATTRIBUTION source credit was wired in.
