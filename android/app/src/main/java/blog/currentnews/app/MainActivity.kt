package blog.currentnews.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Dialog
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebSettings
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    private val requestNotificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    private var popupDialog: Dialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        // Register Native Google Auth Plugin with device account chooser
        registerPlugin(NativeGoogleAuthPlugin::class.java)

        super.onCreate(savedInstanceState)
        requestNotificationPermission()
        setupNativeWebViewSettings()
        setupNativeBackGestureHandler()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupNativeWebViewSettings() {
        val webView = bridge?.webView ?: return

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

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    override fun onDestroy() {
        try {
            popupDialog?.dismiss()
            popupDialog = null
        } catch (_: Exception) {}
        super.onDestroy()
    }
}
