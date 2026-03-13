# NightOut Mobile

React Native (Expo) mobile app for NightOut — restaurant discovery, concierge chat, social feed, and venue profiles.

## Setup

1. **Copy environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in values from the main NightOut web app:
   - `EXPO_PUBLIC_SUPABASE_URL` — same as `VITE_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same as `VITE_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_SEARCH_API_URL` — for local dev, use your machine's IP (e.g. `http://192.168.1.100:3001`) since `localhost` on a device points to the device itself

2. **Install dependencies** (already done if you cloned)
   ```bash
   npm install
   ```

3. **Run the web backend** (from the main NightOut repo)
   ```bash
   cd ../NightOut
   npm run dev:all
   ```

4. **Start the mobile app**
   ```bash
   npm start
   ```
   Then scan the QR code with Expo Go (Android) or Camera (iOS).

## Project Structure

```
src/
  theme/          # Design system (colors, typography, spacing)
  lib/            # Supabase client, config
  navigation/     # Tab + stack navigators
  screens/        # Browse, Chat, Social, Profile, Notifications
```

## Backend Connection

This app uses the **same Supabase project** and **same Node search API** as the web app. No separate backend.

- **Supabase**: Auth, venue data, reviews, lists, social, notifications
- **Search API**: Concierge chat, venue search (runs in NightOut repo)

## Current Status

- ✅ App shell with bottom tabs (Browse, Chat, Social, Profile)
- ✅ Header with notification bell
- ✅ Design system (neutral, premium palette)
- ✅ Screen scaffolding with empty states
- 🔲 Connect to Supabase auth
- 🔲 Implement venue discovery, chat concierge, social feed
- 🔲 Venue profiles, lists, saved, Top 10
- 🔲 Review creation, notifications

## Repository

This is a **separate repository** from the main NightOut web app. To create a new repo:

```bash
cd nightout-mobile
git init
git add .
git commit -m "Initial React Native app shell"
# Create repo on GitHub, then:
git remote add origin https://github.com/your-org/nightout-mobile.git
git push -u origin main
```
