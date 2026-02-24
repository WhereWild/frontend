# Motion tokens (Time + Easing)

Use motion tokens from `constants/theme.ts` to keep timing behavior consistent across screens.

- `Time.duration.*` defines animation duration in milliseconds.
- `getReactNativeEasing(name)` maps a tokenized easing name to a React Native easing function, where `name` is a `TimeEasingName` (the keys used by `Time.easing.*` / `TimeEasingCurves.*`).
- `Time.easing.*` exposes raw easing strings (e.g., CSS `cubic-bezier(...)` values), while `TimeEasingCurves.*` exposes the same easings as parsed numeric control-point arrays; both are mainly useful for debugging, previews, and docs.

## Sane usage guidelines

- Use tokenized durations for UI transitions (button press feedback, accordion expand/collapse, tab indicator movement).
- Keep decorative loops subtle and rare; prefer motion tied to a user action or state change.
- For enter/exit transitions, it is valid to use easing in both directions; many UIs use different curves for in vs out.
- For demonstrations and comparisons of easing behavior, use mono-directional motion so curve differences are easier to see.
