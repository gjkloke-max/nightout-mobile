# Push notifications

## How it works

1. Someone likes, follows or comments. Their app saves a row in `public.notifications`, as before.
2. A database trigger sees the new row. If the recipient has a phone registered for push, it calls
   the `send-push` Supabase Edge Function. (Web repo: `migrations/notification_mobile_push.sql` and
   `supabase/functions/send-push`.)
3. `send-push` checks the recipient's **Mobile push** toggle for that category, then sends through
   Expo's push service. Expo passes the push to Apple (APNs) or Google (FCM).
4. Every attempt is logged in `public.notification_deliveries`. Phones that have uninstalled the app
   are removed from `public.notification_push_targets` automatically.

What the app does (`src/services/pushNotifications.js`, `src/hooks/usePushNotifications.js`):

- **Asking for permission.** The app never asks on first launch.
  - After your first follow, it asks once with its own question. The iOS/Android system prompt
    appears only if you tap **Turn on**.
  - **Settings → Notification Settings** shows a banner while push is off. If you previously said
    no, the banner opens the phone's Settings app instead.
- **The phone's push token.** It is saved for the signed-in user on every app start, and removed on
  sign-out.
- **Tapping a push** opens the right screen: the post, the profile or the list. It also marks the
  notification as read.

If **In-app** is off for a category, no push is sent for it either. Those notifications are never
created at all.

Apple and Google can only deliver the push if they are given credentials, which are set up once
(below). These credentials are free.

---

## One-time setup: iOS (Apple push key)

EAS isn't installed as a global command on this machine, so every `eas` command here is run as
`npx eas-cli ...`, from `C:\Development
ightout-mobile` (not the web repo).

You need your Apple Developer login. EAS stores the key for you.

1. Open a terminal in `C:\Development\nightout-mobile` and run:
   ```
   npx eas-cli credentials -p ios
   ```
2. Pick the **production** build profile.
3. Choose **Push Notifications: Manage your Apple Push Notifications Key**.
4. Choose **Set up your project to use Push Notifications**, then let EAS **generate a new key**.
   - Sign in with your Apple ID and the 2-factor code when it asks.
   - When it finishes, EAS shows the key as assigned to `com.nightout.mobile`.

   If EAS can't create the key (Apple allows only 2 push keys per team), make one by hand:
   1. Go to developer.apple.com → **Certificates, Identifiers & Profiles** → **Keys** → **+**.
   2. Name it `Brio Push`, tick **Apple Push Notifications service (APNs)** and click **Configure**.
      Choose **Sandbox & Production** and **Team Scoped (All Topics)**, then **Save**.
   3. Click **Continue**, then **Register**. **Download** the `.p8` file. Apple lets you download it
      only once, so keep it safe and outside the repo. Note the **Key ID** shown on that page.
   4. Back in `npx eas-cli credentials -p ios`, choose to **upload** an existing key. Give it:
      - the `.p8` path,
      - the Key ID,
      - Team ID `Z9KW47RY6P`.
5. Nothing else is needed now. The first iOS build after this turns on the Push capability for the
   app ID and makes a new provisioning profile. It may ask you to sign in to Apple; say yes.
   - If that build fails with *"Provisioning profile doesn't support the Push Notifications
     capability"*:
     1. Run `npx eas-cli credentials -p ios` → production → **Provisioning Profile** → remove it.
     2. Build again, and EAS makes a fresh profile.

## One-time setup: Android (Firebase Cloud Messaging)

Android pushes go through Firebase. This uses the existing Google Cloud project **NightOut**
(`nightout-480519`), so nothing new is created on the billing side.

### A. Add Firebase to the NightOut project

1. Go to <https://console.firebase.google.com>. Click **Create a Firebase project** (or **Add
   project**), then choose the option to **add Firebase to an existing Google Cloud project**.
2. Pick **NightOut (nightout-480519)**. Google Analytics is not needed, so you can turn it off.
   Finish the steps.
3. On the project's home page, click the **Android** icon (**Add app**).
   - **Package name:** `com.nightout.mobile` (it must be exactly this).
   - **Nickname:** `Brio Android`. The SHA-1 field can stay empty; push doesn't need it.
   - Click **Register app**.
4. Click **Download google-services.json**. Skip the remaining "add the SDK" steps, because Expo
   handles them.
5. Check that FCM is on: gear icon → **Project settings** → **Cloud Messaging** tab.
   **Firebase Cloud Messaging API (V1)** should say **Enabled**. If it doesn't, use the ⋮ menu
   there to enable it.

### B. Give `google-services.json` to EAS

The file is not committed to git (it's in `.gitignore`), so EAS gets it as a file variable:

1. Go to <https://expo.dev> → the **nightout-mobile** project → **Environment variables** →
   **Add variable**, and fill in:
   - **Name:** `GOOGLE_SERVICES_JSON`
   - **Type:** **File**. Upload the `google-services.json` you downloaded.
   - **Environments:** tick **production**, plus **preview** and **development** if you use them.
   - **Visibility:** **Secret**.
2. Also copy the file to `C:\Development\nightout-mobile\google-services.json`. Builds run from
   your own machine use it there, and git ignores it.

To do the same from the terminal instead:
```
npx eas-cli env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --visibility secret
```

### C. Upload the FCM service-account key to EAS

This key lets Expo's servers send through your Firebase project.

1. In the Firebase console: gear → **Project settings** → **Service accounts** tab.
2. Click **Generate new private key**, then **Generate key**. A `.json` file downloads.
   - Treat it like a password.
   - Save it **outside** the repo, e.g. `Documents\Brio keys\`.
3. In `C:\Development\nightout-mobile` run:
   ```
   npx eas-cli credentials -p android
   ```
4. Pick **production**, then choose **Google Service Account**.
5. Choose **Manage your Google Service Account Key for Push Notifications (FCM V1)**.
6. Choose **Set up a Google Service Account Key for Push Notifications (FCM V1)**, then **Upload a
   new service account key**, and select the Firebase key file from step 2.

   ⚠️ EAS may offer `google-play-service-account.json` from the project folder. **Don't pick that
   one.** That is the Play Store upload key; choose the Firebase file.

### D. The API key Android push uses (done 2026-11-15)

`google-services.json` did not get a new key. Firebase put the existing **"Android"** key in it, the
Maps key. That key allows only the APIs on its list, so at first Firebase was refused and the app
could not get a push token. The log showed `FIS_AUTH_ERROR` and *Firebase Installations: 403
Permission denied*.

Fix, in Google Cloud console → **APIs & Services** → **Credentials** → **Android** → **API
restrictions**, where these three are now allowed:
- **Maps SDK for Android** (the map)
- **Firebase Installations API** (push)
- **FCM Registration API** (push)

Keep its application restriction as it is: Android apps, `com.nightout.mobile` + the Play
app-signing SHA-1. If that list ever loses the two Firebase APIs, Android push stops silently.

The *"Browser key (auto created by Firebase)"* is not used by the app.

---

## Building and testing

Release: **1.0.2**, iOS build **19**, Android versionCode **6** (already set in `app.config.js`). Build 19 / 6 adds
scrolling to the comment when a comment, reply or mention notification is tapped.
Don't ship iOS 16 / Android 3: they re-registered the push token in a loop (~50 calls a second).
This build also carries the earlier fixes: no `**` in concierge links, and the real version shown in
Settings. For the App Store version, paste the description from `store-assets/description.txt`.

1. `npx expo export --platform ios --output-dir <temp folder>`. This checks the code bundles.
2. Commit. EAS builds from git HEAD, not from uncommitted files.
3. `npx eas-cli build -p ios --profile production` and `npx eas-cli build -p android --profile production`.
4. Test **before** submitting for review:
   - **iOS:** use TestFlight.
   - **Android:** use the Play **internal testing** track.

   Push does not work in Expo Go or the iOS Simulator; it needs a real phone running a real build.
5. Test with two phones (or one phone plus the web app), signed in as two accounts, A and B:
   1. On phone B, follow someone. Tap **Turn on** in the question, then **Allow** in the system
      prompt.
   2. From A, like one of B's posts. **B gets a push.**
   3. On B, tap it. **The post opens.**
   4. From A, follow B. **B gets a push**, and tapping it **opens A's profile**.
   5. On B, go to Settings → Notification Settings and turn off **Likes → Mobile push**.
   6. From A, like another of B's posts. **No push** this time, but it is still in B's in-app feed.
   7. On B, sign out. From A, like again. **No push** to that phone.
6. To see what happened on the server, run in the Supabase SQL editor:
   ```sql
   select d.id, n.type, n.body, d.status, d.error, d.created_at
   from public.notification_deliveries d join public.notifications n on n.id = d.notification_id
   where d.channel = 'mobile_push' order by d.id desc limit 20;
   ```
   If a phone never shows up in `public.notification_push_targets`, open Notification Settings on
   it: when the token can't be fetched or saved, a grey line there says why.

   The `status` values mean:
   - `sent`: Expo accepted it;
   - `skipped` + `mobile_push_disabled`: the toggle is off;
   - `failed` + `DeviceNotRegistered`: the phone's token was dead, and it has been removed.
