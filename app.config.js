require('dotenv').config();

// `owner` is what makes Expo Go demand a login: when a project declares an owner, Expo Go will only
// open it for someone signed in to an account with access. Staging is opened by testers who do not
// have Expo accounts, so the dev server must serve a manifest without it — that is how this worked
// before the owner field was added for EAS.
//
// EAS does not need it here: the project is resolved by extra.eas.projectId below. It is still
// emitted on EAS builds, and EXPO_INCLUDE_OWNER=1 forces it back on if a future eas command ever
// asks for it.
const includeOwner =
  process.env.EAS_BUILD === 'true' || process.env.EXPO_INCLUDE_OWNER === '1';

module.exports = {
  expo: {
    name: 'Brio',
    slug: 'nightout-mobile',
    ...(includeOwner ? { owner: 'gkloke' } : {}),
    scheme: 'nightout',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#F7F5F2',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.nightout.mobile',
      buildNumber: '1',
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
        },
      },
    },
    android: {
      package: 'com.nightout.mobile',
      versionCode: 1,
      usesCleartextTraffic: true,
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        backgroundColor: '#F7F5F2',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
      'expo-font',
      'expo-secure-store',
      'expo-apple-authentication',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Night Out uses your location to show where you are on the map next to venue results.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Brio uses your photo library so you can choose a profile picture.',
        },
      ],
    ],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      searchApiUrl: process.env.EXPO_PUBLIC_SEARCH_API_URL,
      conciergeTimeoutMs: process.env.EXPO_PUBLIC_CONCIERGE_TIMEOUT_MS,
      webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL,
      appScheme: process.env.EXPO_PUBLIC_APP_SCHEME,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      eas: {
        projectId: '9c0b95b9-8fde-43c5-9e12-df10b6244d2a',
      },
    },
  },
};
