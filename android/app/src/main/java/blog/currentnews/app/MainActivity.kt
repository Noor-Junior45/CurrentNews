package blog.currentnews.app

import android.annotation.SuppressLint
import android.app.Dialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.getcapacitor.BridgeActivity
import org.json.JSONObject
import java.security.MessageDigest

class MainActivity : BridgeActivity() {

    private var popupDialog: Dialog? = null

    @Volatile
    private var pendingNavigationPath: String? = null

    inner class NotificationNavBridge {
        @JavascriptInterface
        fun consumePendingPath(): String? {
            val path = pendingNavigationPath
            pendingNavigationPath = null
            return path
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Modern Android 15 (API 35+) Edge-to-Edge display support with backwards compatibility
        enableEdgeToEdge()

        // Register Native Google Auth Plugin with device account chooser
        registerPlugin(NativeGoogleAuthPlugin::class.java)

        // Capture any article path from cold-start notification tap before WebView boots
        captureNotificationIntent(intent, dispatchImmediately = false)

        super.onCreate(savedInstanceState)
        setupEdgeToEdgeInsets()
        printFingerprintsToLogcat()
        setupNativeWebViewSettings()
        setupNativeBackGestureHandler()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // Navigate immediately when notification is tapped while app is already open
        captureNotificationIntent(intent, dispatchImmediately = true)
    }

    private fun captureNotificationIntent(incomingIntent: Intent?, dispatchImmediately: Boolean) {
        if (incomingIntent == null) return

        val viewDataUrl = if (
            incomingIntent.action == Intent.ACTION_VIEW &&
            (incomingIntent.data?.scheme == "https" || incomingIntent.data?.scheme == "http")
        ) {
            incomingIntent.dataString
        } else {
            null
        }

        val rawTarget = incomingIntent.getStringExtra(CurrentNewsFirebaseMessagingService.EXTRA_TARGET_PATH)
            ?: incomingIntent.getStringExtra(CurrentNewsFirebaseMessagingService.EXTRA_TARGET_URL)
            ?: incomingIntent.getStringExtra("url")
            ?: incomingIntent.getStringExtra("link")
            ?: viewDataUrl

        if (rawTarget.isNullOrBlank()) return

        // Clear consumed extras so activity recreation / rotation does not re-trigger navigation
        incomingIntent.removeExtra(CurrentNewsFirebaseMessagingService.EXTRA_TARGET_PATH)
        incomingIntent.removeExtra(CurrentNewsFirebaseMessagingService.EXTRA_TARGET_URL)
        incomingIntent.removeExtra("url")
        incomingIntent.removeExtra("link")

        val path = CurrentNewsFirebaseMessagingService.extractArticlePath(rawTarget)
        pendingNavigationPath = path

        if (dispatchImmediately) {
            dispatchPathToWebView(path)
        }
    }

    private fun dispatchPathToWebView(path: String) {
        val webView = bridge?.webView ?: return
        val quotedPath = JSONObject.quote(path)
        webView.post {
            webView.evaluateJavascript(
                "(function(){" +
                    "window.__CN_PENDING_NOTIFICATION_PATH__ = $quotedPath;" +
                    "window.dispatchEvent(new CustomEvent('currentnews-native-navigate', { detail: { path: $quotedPath } }));" +
                "})();",
                null
            )
        }
    }

    /**
     * Handles window insets (status bar, navigation bar, and display cutouts)
     * as required by Android 15 (API 35+) edge-to-edge guidelines so webview content
     * is never obscured by the system status bar, notch cutouts, or gesture navigation bar.
     */
    private fun setupEdgeToEdgeInsets() {
        val rootView = findViewById<View>(android.R.id.content) ?: return
        ViewCompat.setOnApplyWindowInsetsListener(rootView) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            windowInsets
        }
    }

    /**
     * Prints the exact SHA-1 and SHA-256 fingerprints of this running APK
     * directly to Android Studio's Logcat under tag CURRENTNEWS_SIGNING.
     * Easily copied into Firebase Console -> Project Settings -> Your Apps.
     */
    private fun printFingerprintsToLogcat() {
        try {
            val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
            } else {
                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
            }

            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.signingInfo?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }

            val cert = signatures?.firstOrNull()?.toByteArray() ?: return

            val sha1 = MessageDigest.getInstance("SHA-1").digest(cert).joinToString(":") { String.format("%02X", it) }
            val sha256 = MessageDigest.getInstance("SHA-256").digest(cert).joinToString(":") { String.format("%02X", it) }

            Log.i("CURRENTNEWS_SIGNING", "==========================================================================")
            Log.i("CURRENTNEWS_SIGNING", "🔑 [Current News] ANDROID CERTIFICATE FINGERPRINTS:")
            Log.i("CURRENTNEWS_SIGNING", "📱 Package Name: $packageName")
            Log.i("CURRENTNEWS_SIGNING", "👉 SHA-1:   $sha1")
            Log.i("CURRENTNEWS_SIGNING", "👉 SHA-256: $sha256")
            Log.i("CURRENTNEWS_SIGNING", "ℹ️ Add these in Firebase Console -> Project Settings -> Your Apps (blog.currentnews.app)")
            Log.i("CURRENTNEWS_SIGNING", "==========================================================================")
        } catch (e: Exception) {
            Log.e("CURRENTNEWS_SIGNING", "Could not read signing certificate: ${e.message}")
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupNativeWebViewSettings() {
        val webView = bridge?.webView ?: return

        // Register JS interface for cold-start and resume notification deep-link navigation
        webView.addJavascriptInterface(NotificationNavBridge(), "CurrentNewsNotificationBridge")

        // 1. Enable cookies for cross-origin state
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        // 2. Configure WebView settings for high-performance native app standards
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // Prevent Google OAuth "disallowed_useragent" error when browsing web resources
            userAgentString = userAgentString.replace("; wv", "")
        }
    }

    /**
     * Native Android Phone Edge-Swipe Back Gesture & System Navigation Handler.
     * Delegates to JavaScript in-app handler so reading an article never closes the app,
     * and returns to the exact same page index and scroll position on the home feed.
     */
    private fun setupNativeBackGestureHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (popupDialog?.isShowing == true) {
                    popupDialog?.dismiss()
                    popupDialog = null
                    return
                }

                val webView = bridge?.webView
                if (webView != null) {
                    webView.evaluateJavascript(
                        "(function(){ if (typeof window.__handleAndroidBackButton === 'function') { return window.__handleAndroidBackButton(); } return false; })();"
                    ) { result ->
                        val handled = result?.replace("\"", "")?.toBoolean() ?: false
                        if (!handled) {
                            // User double-tapped on home feed or explicitly chose to exit
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                            isEnabled = true
                        }
                    }
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })
    }

    override fun onDestroy() {
        try {
            popupDialog?.dismiss()
            popupDialog = null
        } catch (_: Exception) {}
        super.onDestroy()
    }
}
