# Welcome to the WhereWild front end repository

[![pipeline status](https://capstone.cs.utah.edu/wherewild/front-end/badges/main/pipeline.svg)](https://capstone.cs.utah.edu/wherewild/front-end/-/commits/main)
[![coverage report](https://capstone.cs.utah.edu/wherewild/front-end/badges/main/coverage.svg)](https://capstone.cs.utah.edu/wherewild/front-end/-/commits/main)

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

This project has some VS Code helper configured. Open `front-end.code-workspace` as a workspace in VS Code. VS Code will auto-prompt to install the workspace-recommended extensions when the workspace or folder is opened.

### Prerequisites

1. Install Node v24.13.0
2. For mobile development, follow https://docs.expo.dev/get-started/set-up-your-environment
    - We have Expo Application Services set up
3. Install dependencies

   ```bash
   npm install
   ```

4. Clone WhereWild's fork of Figma's Simple Design System repository alongside this repository (not in it). Assuming PWD is this repository,

   ```bash
   git clone https://github.com/KellyNyanbinary/wherewild-design-system.git ../wherewild-design-system
   ```

   This folder is also listed as a dependency in the VS Code workspace.

### Starting

Start the app

```bash
npm start
```

Use production env values when starting:

```bash
npm run start:prod
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Scripts

### Start

- `npm start` uses `.env.local` if present
    - You likely want to create `.env.local` containing `APP_BACKEND_URL=http://localhost:8000`
- `npm run start:prod` uses `.env` even if `.env.local` is present.
    - It disables Expo's automatic dotenv loading and injects `.env` into the Expo process directly.

### Tests

Run

```bash
npm test
```

to run tests.

Run

```bash
npm run test:coverage
```

to get a coverage report.

### Lint

Run

```bash
npm run lint
```

to get a lint report.

Run

```bash
npm run lint:fix
```

to auto fix linting issues.

### Typechecking

Run

```bash
npm run typecheck
```

to typecheck.

### Sync Tokens from Design System

Run

```bash
npm run sync-theme
```

to sync the design tokens from the design system repository.

## Environment variables

This app does not require any environment variables for local development, but it supports overrides:

- `.env.local` is used for the default local development flow, including `npm start`
- `.env` is used by `npm run start:prod` and by production web exports
- Optional: `APP_STADIA_MAPS_API_KEY` adds explicit Stadia tile authentication.
    - Recommended for native/mobile builds.
    - Also useful on web if domain or localhost-based Stadia auth is not working in your environment.
- The Stadia Maps key is exposed to the app through Expo runtime config (`Constants.expoConfig.extra.stadiaMapsApiKey`) using the same plain-env naming convention as other app runtime settings.
- The backend base URL is exposed to the app through Expo runtime config (`Constants.expoConfig.extra.backendUrl`) so switching between local and prod startup modes does not depend on Metro reusing or invalidating previously inlined env transforms
- `npm run start:prod` and `npm run export:web` disable Expo's automatic dotenv loading and load `.env` in memory instead, so `.env.local` is ignored for those commands without renaming files on disk
- You can override the backend URL per command:

    ```bash
    npm run export:web -- --backendUrl=http://localhost:8000
    ```

    When `--backendUrl` is provided, `export-web.mjs` still loads `.env`, but the explicit backend URL overrides the `.env` backend value for that export.

### Adding a new variable

Use one of these two patterns depending on who needs the value.

#### Script-only variables

If only a Node script needs the value, add it to `.env` or `.env.local` and read it from `process.env` inside the script.

Example:

```env
MY_SCRIPT_FLAG=true
```

```js
const myScriptFlag = process.env.MY_SCRIPT_FLAG;
```

#### App runtime variables

If the app itself needs the value at runtime, add it to `.env`, expose it through `app.config.js`, and read it through `expo-constants`.

Example:

```env
APP_API_TIMEOUT_MS=5000
```

```js
extra: {
    ...appJson.expo.extra,
    backendUrl: process.env.APP_BACKEND_URL || fallbackBackendUrl,
    apiTimeoutMs: process.env.APP_API_TIMEOUT_MS || '5000',
},
```

```ts
import Constants from 'expo-constants';

const apiTimeoutMs = Constants.expoConfig?.extra?.apiTimeoutMs;
```

This is the preferred pattern for new app-consumed configuration because it avoids relying on Expo's compile-time `process.env.EXPO_PUBLIC_*` inlining.

### Naming convention

- Use `APP_BACKEND_URL` for the backend base URL. It is read by Node config/scripts and then exposed to the app through Expo runtime config.
- For new script-only variables, use descriptive names and read them directly from `process.env`.
- For new app runtime variables, prefer a plain env variable name such as `APP_API_TIMEOUT_MS`, map it to a camelCase Expo `extra` key such as `apiTimeoutMs`, and read it through `Constants.expoConfig?.extra`.
- Reserve `EXPO_PUBLIC_*` for cases where you intentionally want Expo to inline a value at build time. That is no longer the default pattern in this repository.

In practice:

- `.env` key: `APP_API_TIMEOUT_MS`
- Expo runtime key: `apiTimeoutMs`
- App access: `Constants.expoConfig?.extra?.apiTimeoutMs`

## CI

The badges at the top of this README reflect the latest pipeline and coverage status for the `main` branch in GitLab.

## Troubleshooting

- If Metro hangs or shows stale bundles, reset the cache:

    ```bash
    npx expo start -c
    ```

- For iOS/Android setup problems, follow Expo’s device/emulator docs:
    - [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
    - [Android simulator](https://docs.expo.dev/workflow/android-studio-emulator/)

- If Expo complains, run

    ```bash
    npx expo-doctor
    ```

    to troubleshoot Expo.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.
