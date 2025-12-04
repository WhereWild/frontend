/*
 * Temporary environment/feature flags used while the capstone prototype ships
 * without fully functional controls. Remove these when promoting the app to
 * production.
 */

// jest.setup.js imports this helper so test skips are driven by the exact same
// semantics as the runtime flags. Keep it exported to avoid subtle drift.
// Example shell usage (macOS/Linux):
//   EXPO_PUBLIC_DISABLE_SECONDARY_CONTROLS=false EXPO_PUBLIC_DISABLE_DOWNLOAD_BUTTONS=false npm test -- --coverage
export const readBooleanEnv = (value: string | undefined, fallback: boolean) => {
  if (value == null) {
    return fallback;
  }
  return value === 'true' || value === '1';
};

// These derived values reflect the shell environment passed to Expo. Expo's app
// config does not populate process.env when Jest runs, so tests must also set
// the EXPO_PUBLIC_* variables explicitly if they need non-default behavior.
// Example shell usage (macOS/Linux):
//   EXPO_PUBLIC_IS_CAPSTONE_PROTOTYPE=false npm start
// To run the full prototype configuration with controls disabled:
//   EXPO_PUBLIC_IS_CAPSTONE_PROTOTYPE=true \
//   EXPO_PUBLIC_DISABLE_SECONDARY_CONTROLS=true \
//   EXPO_PUBLIC_DISABLE_DOWNLOAD_BUTTONS=true \
//   npx expo start
const isCapstonePrototype = readBooleanEnv(process.env.EXPO_PUBLIC_IS_CAPSTONE_PROTOTYPE, false);
const disableSecondaryControls = readBooleanEnv(process.env.EXPO_PUBLIC_DISABLE_SECONDARY_CONTROLS, false);
const disableDownloadButtons = readBooleanEnv(process.env.EXPO_PUBLIC_DISABLE_DOWNLOAD_BUTTONS, false);

export const EnvironmentFlags = {
  isCapstonePrototype,
  disableSecondaryControls,
  disableDownloadButtons,
} as const;
