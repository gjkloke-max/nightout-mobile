require('dotenv').config();

module.exports = {
  expo: {
    name: 'nightout-mobile',
    slug: 'nightout-mobile',
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
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
        },
      },
    },
    android: {
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
            'Night Out uses your photo library so you can choose a profile picture.',
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
    },
  },
};
