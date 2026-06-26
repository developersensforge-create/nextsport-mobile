# NextSport Mobile

AI Baseball Swing Analyzer — React Native (Expo) app.

## First-time setup (create GitHub repo + push):

```bash
# 1. Create the repo on GitHub (one-time — your PAT needs repo creation scope)
#    → Go to https://github.com/new → name: nextsport-mobile → Create

# 2. Push code (already committed locally)
cd nextsport-mobile
git remote set-url origin https://github.com/ruizhi1201/nextsport-mobile.git
git push -u origin main
```

## To build the APK (pilot):

1. `npm install`
2. `eas login` (use your Expo account)
3. `eas build --profile preview --platform android`
4. Download APK from the link provided
5. Upload to Firebase App Distribution

That's it.

---

## Project Structure

```
src/
  screens/          # All app screens
  components/       # Reusable UI components
  navigation/       # React Navigation setup
  lib/              # Supabase client + API helpers
  hooks/            # Auth + profile hooks
  theme.ts          # Design tokens
App.tsx             # Root component
app.json            # Expo config
eas.json            # EAS Build config
```

## Backend

The mobile app connects to the existing NextSport backend at `https://nextsport.vercel.app`. All API calls use the Supabase JWT for authentication.

## Dev Setup (optional)

```bash
npm install
npx expo start
# Scan QR code with Expo Go app
```
