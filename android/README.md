# Current News - Capacitor & Android Studio Build Guide (API 36 / Android 13+)

This project is fully configured with **Capacitor**, **Gradle**, and **Android Studio**. You can build your APK using the familiar `npm` and `npx cap` commands.

---

## Technical Specifications
- **Framework:** Capacitor 8
- **Target SDK:** `36` (Android 16 / API 36)
- **Minimum SDK:** `33` (Android 13 / Tiramisu and above)
- **Compile SDK:** `36`
- **Application ID:** `blog.currentnews.app`
- **App Name:** `Current News`

---

## 3-Step Build Workflow (Using Terminal + Android Studio)

### Step 1: Install Dependencies
In your project root terminal (PowerShell or Bash):
```bash
npm install
```

### Step 2: Build Web Assets & Sync to Android
```bash
npm run build
npx cap sync android
```
*(Or run the all-in-one shortcut: `npm run cap:build`)*

### Step 3: Open in Android Studio & Build APK
```bash
npx cap open android
```
Or open **Android Studio**, choose **File > Open**, and select the `android` folder (`C:\Users\mdhas\Downloads\CurrentNews\android`).

Inside **Android Studio**:
1. Click **File** → **Sync Project with Gradle Files** (elephant icon at top right).
2. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**.
3. Click **locate** in the popup notification to get your `app-debug.apk`.

---

## App Icons
All Android launcher mipmap icons (MDPI, HDPI, XHDPI, XXHDPI, XXXHDPI) and web PWA icons have been updated using `public/CurrentNews.png`.
