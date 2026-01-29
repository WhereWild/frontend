# Welcome to the WhereWild front end repository

[![pipeline status](https://capstone.cs.utah.edu/wherewild/front-end/badges/main/pipeline.svg)](https://capstone.cs.utah.edu/wherewild/front-end/-/commits/main)
[![coverage report](https://capstone.cs.utah.edu/wherewild/front-end/badges/main/coverage.svg)](https://capstone.cs.utah.edu/wherewild/front-end/-/commits/main)

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

This project has some VS Code helper configured. Open `front-end.code-workspace` as a workspace in VS Code. VS Code will auto-prompt to install the workspace-recommended extensions when the workspace or folder is opened.

### Prerequisites

1. Install Node v24.13.0
2. Install dependencies

   ```bash
   npm install
   ```

3. Clone WhereWild's fork of Figma's Simple Design System repository alongside this repository (not in it). Assuming PWD is this repository,

   ```bash
   git clone https://github.com/KellyNyanbinary/wherewild-design-system.git ../wherewild-design-system
   ```

   This folder is also listed as a dependency in the VS Code workspace.

### Starting

Start the app

```bash
npm start
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Scripts

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

This app does not require any environment variables for local development.

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
