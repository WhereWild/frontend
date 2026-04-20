const appVariant = process.env.APP_VARIANT ?? 'production';
const isDevelopment = appVariant === 'development';
const isPreview = appVariant === 'preview';
const fallbackBackendUrl = 'http://localhost:8000';
const siteUrl = process.env.APP_SITE_URL?.trim() || null;
const stadiaMapsApiKey = process.env.APP_STADIA_MAPS_API_KEY?.trim() || null;

const appName = isDevelopment
  ? 'WhereWild Dev'
  : isPreview
    ? 'WhereWild Preview'
    : 'WhereWild';

const appScheme = isDevelopment
  ? 'wherewild-dev'
  : isPreview
    ? 'wherewild-preview'
    : 'wherewild';

const applicationId = isDevelopment
  ? 'com.wherewild.wherewild.dev'
  : isPreview
    ? 'com.wherewild.wherewild.preview'
    : 'com.wherewild.wherewild';

module.exports = () => ({
  expo: {
    name: appName,
    slug: 'wherewild',
    owner: 'wherewild',
    version: '0.0.1',
    orientation: 'portrait',
    icon: './assets/images/wherewild.png',
    scheme: appScheme,
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/images/wherewild.icon',
      supportsTablet: true,
      bundleIdentifier: applicationId,
      infoPlist: {
        UIApplicationSupportsIndirectInputEvents: true,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: applicationId,
      adaptiveIcon: {
        backgroundColor: '#FFFFFF',
        foregroundImage: './assets/images/wherewild-android-foreground.png',
        backgroundImage: './assets/images/wherewild-android-background.png',
        monochromeImage: './assets/images/wherewild-android-monochrome.png',
      },
      predictiveBackGestureEnabled: true,
    },
    web: {
      // Server output is required for Expo Router server middleware and dynamic
      // metadata generation; this must be deployed to a Node.js runtime rather
      // than static file hosting.
      output: 'server',
      favicon: './assets/images/wherewild-favicon.png',
    },
    plugins: [
      [
        'expo-router',
        {
          unstable_useServerMiddleware: true,
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/wherewild.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      'expo-web-browser',
      [
        'expo-dev-client',
        {
          addGeneratedScheme: !!isDevelopment,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'd3ad3c1f-1bc6-45c4-915d-cb561fcd61c3',
      },
      appVariant,
      backendUrl: process.env.APP_BACKEND_URL || fallbackBackendUrl,
      siteUrl,
      stadiaMapsApiKey,
    },
  },
});
