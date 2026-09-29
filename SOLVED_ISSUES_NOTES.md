# 📋 Current News — Solved Issues & Architecture Notes

This file tracks all resolved issues, technical architectural decisions, and configurations for the **Current News** application (Web, PWA, and Native Android App).

---

## 🛠 Solved Issues Log

### 1. Gradle Sync Kotlin DSL Failure
* **Symptoms:**
  * `e: file:///.../build.gradle.kts:31:39: Unresolved reference: util`
  * `e: file:///.../build.gradle.kts:34:33: Overload resolution ambiguity: File(...)`
* **Root Cause:**
  * In Gradle's Kotlin DSL (`android { ... }` block), `java` refers to the `JavaPluginExtension`, not the Java core package. Writing `java.util.Properties()` caused Gradle to look for `.util` on the Gradle extension.
  * `properties.getProperty(...)` returns a platform type `String!`, which led Kotlin to report ambiguity between `File(String)` and `File(URI)`.
* **Resolution:**
  * Added explicit standard imports at the top of `android/app/build.gradle.kts`:
    ```kotlin
    import java.io.File
    import java.util.Properties
    ```
  * Initialized `Properties()` directly without namespace collision.
  * Explicitly typed `storeFilePath: String` and resolved files cleanly via `rootProject.file(...)`.

---

### 2. Android Back Button Closing App During Article Reading & Losing Page Index
* **Symptoms:**
  * When reading an article, pressing the Android back button or predictive back gesture closed the app instead of navigating back to the home feed.
  * When navigating back to Home, the page index was lost (reset to page 1 instead of staying on page 2, 3, etc.).
* **Root Cause:**
  * `MainActivity.kt` did not register an `OnBackPressedCallback` with `onBackPressedDispatcher`. Under Android 13+ (API 33+), unhandled back gestures invoke default system `finish()`.
  * `AndroidBackGestureHandler.tsx` did not handle `/post/...` routes specifically or preserve URL search parameters (`?page=...&category=...`).
* **Resolution:**
  * **Native Android (`MainActivity.kt`):** Added `setupNativeBackGestureHandler()` using AndroidX `OnBackPressedCallback` hooked to `onBackPressedDispatcher`. It delegates to `window.__handleAndroidBackButton()` in the webview.
  * **Unified In-App Handler (`AndroidBackGestureHandler.tsx`):**
    * When on an article (`/post/...`), pressing back navigates to Home with the exact same category and page index (`?page=X`) and restores the reading scroll position.
    * Never closes the app from an article view.
    * On the Home feed (`/`), single back press shows a subtle toast ("Press back again to exit Current News"), and double back press within 2.5s exits the app.
  * **Page Index Cache (`BlogPostCard.tsx` & `HomeView.tsx`):** Cached `current_news_return_search`, `current_news_return_page`, and `current_news_return_scroll` into `sessionStorage` so returning to Home preserves the exact pagination state and scroll position.

---

### 3. Google Sign-In Opening Webview/Popup with Password Prompt vs. Native Device Account Picker
* **Symptoms:**
  * When signing in on Android, the app opened a web browser/popup asking the user to manually type their Gmail and password, often resulting in `Firebase: Error (auth/cancelled-popup-request)`.
* **Root Cause:**
  * The app was using Firebase Web's `signInWithPopup`, which creates an OAuth web flow inside a WebView dialog rather than using Android's native Google Play Services.
* **Resolution:**
  * Added `com.google.android.gms:play-services-auth:21.3.0` to `android/app/build.gradle.kts`.
  * Built `NativeGoogleAuthPlugin.kt` which invokes the **native Android Google Account Chooser bottom sheet** via Google Play Services `GoogleSignInClient`.
  * Users tap their device's already-logged-in Gmail account with **one tap** (no password prompt, no web popup).
  * The plugin securely returns the Google ID Token, which `authHelper.ts` exchanges for a Firebase Auth credential using `signInWithCredential(auth, credential)`.
  * On desktop/web browsers, `authHelper.ts` smoothly falls back to standard web popup authentication.

---

### 4. Cache Memory Resumption for Left-in-Half Articles
* **Feature:**
  * When a user starts reading an article and exits before finishing, their scroll progress is automatically saved to local cache memory (`localStorage`).
  * When they reopen the article or view the Home feed, a "Resume Reading" banner allows them to jump right back to where they left off.
* **Implementation:**
  * `src/utils/readingProgress.ts`: Tracks scroll progress, title, category, and timestamp.
  * `PostDetailView.tsx`: Monitors scroll depth, displays the "Resume Reading" prompt if progress is between 5% and 92%.
  * `HomeView.tsx`: Displays the "Continue Reading" shelf for in-progress articles.

---

### 5. Native Android Framework Update (Capacitor Native vs. Webview Wrapper)
* **Improvements:**
  * Standardized `capacitor.config.ts` and `capacitor.config.json` to load bundled local assets from `webDir: 'dist'` natively.
  * Removed the `webView.webChromeClient` override in `MainActivity.kt` that was breaking Capacitor's native bridge.
  * Compiled and synced all assets into `android/app/src/main/assets/public` using `npm run cap:build` (`npx cap sync android`).

---

## 📌 How to Add This to Google AI Studio System Instructions

To ensure Google AI Studio always checks and updates this notes file in future conversations, add the following snippet to your **System Instructions** in Google AI Studio:

```markdown
### Project Documentation Protocol
- At the start of every session or task, check `SOLVED_ISSUES_NOTES.md` to understand previously resolved bugs, native Android architecture, and key conventions.
- Whenever a bug is fixed, a new capability is added, or an error is resolved, immediately append the problem description, root cause, and resolution under the "Solved Issues Log" in `SOLVED_ISSUES_NOTES.md`.
- Keep `README.md` and `SOLVED_ISSUES_NOTES.md` synchronized and updated.
```

### Steps to Add in Google AI Studio UI:
1. Open your project in **Google AI Studio** (`https://aistudio.google.com`).
2. Look at the right-hand panel (or the **System Instructions** box at the top left of the prompt window).
3. Paste the markdown block above into the **System Instructions** box.
4. Click **Save** (or continue the session).
5. From then on, the assistant will automatically maintain and reference `SOLVED_ISSUES_NOTES.md`.
