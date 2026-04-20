# Welcome to the WhereWild front end repository

[![pipeline status](https://capstone.cs.utah.edu/wherewild/front-end/badges/main/pipeline.svg)](https://capstone.cs.utah.edu/wherewild/front-end/-/commits/main)
[![coverage report](https://capstone.cs.utah.edu/wherewild/front-end/badges/main/coverage.svg)](https://capstone.cs.utah.edu/wherewild/front-end/-/commits/main)

WhereWild is an [Expo](https://expo.dev) front-end application for exploring species data, environmental summaries, and prediction-driven map views across mobile and web.

## Get started

This project has some VS Code helper configured. Open `front-end.code-workspace` as a workspace in VS Code. VS Code will auto-prompt to install the workspace-recommended extensions when the workspace or folder is opened.

### Prerequisites

1. Install Node v24.13.0
2. For mobile development, follow [the Expo environment setup guide](https://docs.expo.dev/get-started/set-up-your-environment)
    - We have Expo Application Services set up
3. Install dependencies

   ```bash
   npm install
   ```

### Starting

Use the default local development flow:

```bash
npm start
```

Use the production-like local flow that ignores `.env.local` and reads `.env` directly:

```bash
npm run start:production-config
```

For web routes that depend on request-time metadata, start the web server explicitly:

```bash
npm run start:production-config -- --web
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Scripts

### Start

- `npm start` uses Expo's default dotenv precedence, so `.env.local` overrides `.env` when present, and it defaults `APP_VARIANT=development` unless you override it in your shell.
- `npm run start:production-config` disables Expo's automatic dotenv loading, reads `.env` directly, ignores `.env.local`, and explicitly defaults `APP_VARIANT=production` unless you override it in your shell.

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

to regenerate `constants/wds-theme.css` and `constants/wdsTokens.ts` from the
bundled Figma token/style snapshots in `scripts/tokens/`.

If you have Figma REST credentials available, run

```bash
FIGMA_ACCESS_TOKEN=... FIGMA_FILE_KEY=... npm run sync-theme:rest
```

to refresh `scripts/tokens/tokens.json` and `scripts/tokens/styles.json` before
generating the theme files.

If you do not have REST API access, export fresh snapshots with the bundled
Figma plugins in `scripts/tokens/figma-plugin-token-json/` and
`scripts/tokens/figma-plugin-styles-json/`, replace the JSON files under
`scripts/tokens/`, then run `npm run sync-theme` again.

## Environment variables

This app does not require any environment variables for local development, but it supports overrides:

- For local development, prefer `.env.local`. `npm start` follows Expo's default dotenv precedence, so local shell variables win over `.env.local`, and `.env.local` wins over `.env`.
- `npm start` defaults `APP_VARIANT=development` unless you override it in your shell.
- `npm run start:production-config` and `npm run export:web` disable Expo's automatic dotenv loading, read `.env` directly, ignore `.env.local`, and default `APP_VARIANT=production` unless you override it in your shell.
- Web output is configured for Expo Router server mode, so request-time species metadata requires the generated server bundle to run behind a web server or reverse proxy.
- Optional: `APP_SITE_URL` sets the preferred public site origin for generated metadata when no request origin is available.
- EAS cloud builds use EAS-hosted environment variables. Local `.env*` files are not uploaded because `.env*` is gitignored in this repo.
- Optional: `APP_STADIA_MAPS_API_KEY` adds explicit Stadia tile authentication.
    - Recommended for native/mobile builds.
    - Also useful on web if domain or localhost-based Stadia auth is not working in your environment.
- The Stadia Maps key is exposed to the app through Expo runtime config (`Constants.expoConfig.extra.stadiaMapsApiKey`) using the same plain-env naming convention as other app runtime settings.
- The backend base URL is exposed to the app through Expo runtime config (`Constants.expoConfig.extra.backendUrl`) so switching between local and prod startup modes does not depend on Metro reusing or invalidating previously inlined env transforms
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
    router: {},
    eas: {
        projectId: 'your-project-id',
    },
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

For metadata origins:

- `.env` key: `APP_SITE_URL`
- Expo runtime key: `siteUrl`
- App access: `Constants.expoConfig?.extra?.siteUrl`

## Build variants

This repo uses a single dynamic `app.config.js` as the Expo config source of truth.

- `APP_VARIANT=development` builds the development app.
- `APP_VARIANT=preview` builds the preview app.
- `APP_VARIANT=production` builds the production app.

`app.config.js` uses `APP_VARIANT` to switch:

- app display name
- app scheme
- iOS bundle identifier
- Android package name

The backend URL is not variant-specific in this repo. Set `APP_BACKEND_URL` once in EAS environment variables if all three variants should use the same backend.

## Web Runtime

Species open graph metadata is now generated by Expo Router server middleware on web requests to `/species/:taxonId/:slug`.

- Required: a Node-compatible runtime that can execute Expo Router web server output and middleware. A static nginx file host that only serves exported HTML/CSS/JS assets is insufficient.
- The container image serves the pre-exported `dist` bundle with `expo serve dist` in a Node runtime.
- If you want nginx in front, run it separately as a reverse proxy for TLS, caching, or compression.
- `app/+middleware.ts` runs inside that Node server runtime and reads `APP_VARIANT` and `APP_BACKEND_URL` from the live process environment at request time.
- The deployed container or process must provide those runtime env vars directly, for example with container `environment`, `docker run -e`, Kubernetes env config, or `--env-file`. A `.env` file baked into the image is optional and is not required by this deployment model.
- Reverse proxy requirement: forward `Host` and `X-Forwarded-Proto` so generated canonical and Open Graph URLs use the public `https` origin instead of the internal container origin.
- Non-production behavior: preview and development variants emit `noindex, nofollow` metadata while still self-canonicalizing to the environment's public URL.
- Local Docker builds require `dist` to exist first, so run `npm run export:web` before `docker build`.

Current EAS build profiles:

- `development` sets `APP_VARIANT=development`
- `preview` sets `APP_VARIANT=preview`
- `production` sets `APP_VARIANT=production`

This allows all three apps to be installed on one device at the same time because each profile produces a unique iOS bundle identifier and Android package name.

### Precedence and development builds

There are two moments where config is evaluated:

- EAS cloud build time: EAS-hosted environment variables win because the build runs on EAS infrastructure and local `.env` files are not part of that environment.
- Local CLI time: `npm start`, `npm run start:production-config`, and `npm run export:web` evaluate `app.config.js` on your machine. `npm start` defaults `APP_VARIANT=development`, while the production-like commands default `APP_VARIANT=production`.

In practice, a development build created by EAS gets its native identity from the EAS profile at build time, but when that installed build connects to your local development server, the runtime config served by Expo comes from your local environment.

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
