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
      // iPhone only. There is no tablet-specific layout anywhere in the app, and offering it on
      // iPad means Apple requires 13" iPad screenshots and reviewers test it there -- a phone
      // layout stretched to iPad is a standard Guideline 4 (Design) rejection. Flip this back only
      // alongside real iPad layouts.
      supportsTablet: false,
      bundleIdentifier: 'com.nightout.mobile',
      buildNumber: '8',
      infoPlist: {
        // Export compliance. Declared here so App Store Connect does not gate every single upload
        // on answering the encryption question by hand before testers can install.
        //
        // false = "no non-exempt encryption". The app's only cryptography is standard HTTPS to
        // Supabase and the OpenAI API, the iOS Keychain via expo-secure-store, and the aes-js
        // encryption in src/lib/supabase.js that protects the stored Supabase session — encryption
        // used to safeguard the user's own auth token, which is the exempt category. Revisit this
        // if the app ever encrypts user content rather than credentials.
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
        },
      },
    },
    android: {
      package: 'com.nightout.mobile',
      versionCode: 1,
      config: {
        googleMaps: {
          // react-native-maps uses Google Maps on Android (iOS falls through to Apple Maps, since
          // no PROVIDER_GOOGLE is set), and the native SDK reads its key from the manifest rather
          // than from JS. Without this the Android map renders blank.
          //
          // Deliberately a different key from the one the server uses for Places, and deliberately
          // not EXPO_PUBLIC_*, so Metro never inlines it into the JS bundle. This is the one usage
          // Google's application restrictions actually cover: restrict it to Maps SDK for Android
          // plus package com.nightout.mobile and the SHA-1 of the signing cert. With EAS and Play
          // App Signing that fingerprint is Google Play's, from Play Console -> Setup -> App
          // signing, not the local keystore's.
          apiKey: process.env.ANDROID_MAPS_API_KEY,
        },
      },
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
      eas: {
        projectId: '9c0b95b9-8fde-43c5-9e12-df10b6244d2a',
      },
    },
  },
};
