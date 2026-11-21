require('dotenv').config();
const fs = require('fs');
const path = require('path');

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

// Native Google Sign-In (iOS). Client IDs are public identifiers, not secrets. The iOS client ID's
// reversed form is the URL scheme Google's SDK returns to; the plugin is only added when the ID is
// set, so a build without it keeps the browser sign-in instead of failing to build.
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const googleIosUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`
  : null;

// Android push goes through Firebase Cloud Messaging, which needs google-services.json from the
// Firebase project (Google Cloud project "NightOut", nightout-480519). The file is not committed: on
// EAS it comes from the file-type environment variable GOOGLE_SERVICES_JSON (EAS sets that to the
// path of a temporary copy); locally, drop it at ./google-services.json. Without it the app still
// builds and runs, but Android cannot get a push token. See PUSH_NOTIFICATIONS.md.
const localGoogleServices = path.join(__dirname, 'google-services.json');
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (fs.existsSync(localGoogleServices) ? './google-services.json' : undefined);
if (!googleServicesFile && process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PLATFORM === 'android') {
  console.warn('[app.config] GOOGLE_SERVICES_JSON is not set: this Android build will not receive push notifications.');
}

module.exports = {
  expo: {
    name: 'Brio',
    slug: 'nightout-mobile',
    ...(includeOwner ? { owner: 'gkloke' } : {}),
    scheme: 'nightout',
    version: '1.0.3',
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
      buildNumber: '22',
      // Sign in with Apple: adds the entitlement, and EAS enables the capability on the App ID.
      // Without it iOS refuses the Apple sheet (AuthorizationError 1000) and nothing reaches Supabase.
      usesAppleSignIn: true,
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
      versionCode: 9,
      ...(googleServicesFile ? { googleServicesFile } : {}),
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
            'Brio uses your location to show where you are on the map next to venue results.',
        },
      ],
      ...(googleIosUrlScheme
        ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }]]
        : []),
      [
        'expo-notifications',
        {
          // Android status-bar icon: white shape on transparent (Android ignores colour), tinted below.
          icon: './assets/notification-icon.png',
          color: '#9D174D',
          // Must match the channel the app creates and send-push targets (src/services/pushNotifications.js).
          defaultChannel: 'default',
          // iOS aps-environment. App Store / TestFlight builds use Apple's production push servers;
          // development builds use the sandbox.
          mode: process.env.EAS_BUILD_PROFILE === 'production' ? 'production' : 'development',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Brio uses your photo library so you can choose a profile picture.',
        },
      ],
      [
        // Android release builds are shrunk and obfuscated with R8, and unused resources removed.
        // Play Console flagged the app's code optimization at 1% ("below our threshold", fix by
        // February 2027); a shrunk build also uploads the mapping file Play asks for.
        // R8 removes code it cannot see being used, so a library that reaches classes by name can
        // break in a release build only. After changing anything here, test a Play internal build:
        // Google sign-in, maps, push notifications and sign-in by email.
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
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
      googleIosClientId,
      googleWebClientId,
      eas: {
        projectId: '9c0b95b9-8fde-43c5-9e12-df10b6244d2a',
      },
    },
  },
};
