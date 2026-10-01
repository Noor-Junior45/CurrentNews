package blog.currentnews.app

import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import java.security.MessageDigest

/**
 * NativeGoogleAuthPlugin
 * Provides native Android Google Account Chooser bottom sheet/dialog via Google Play Services.
 * Users simply select their device Gmail account with one tap without webview redirects or typing passwords.
 */
@CapacitorPlugin(name = "NativeGoogleAuth")
class NativeGoogleAuthPlugin : Plugin() {

    private var googleSignInClient: GoogleSignInClient? = null

    private fun getClient(serverClientId: String): GoogleSignInClient {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(serverClientId)
            .requestEmail()
            .requestProfile()
            .build()
        return GoogleSignIn.getClient(activity, gso)
    }

    private fun getAppCertificateSha1(): String {
        return try {
            val context = activity.applicationContext
            val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                context.packageManager.getPackageInfo(
                    context.packageName,
                    PackageManager.GET_SIGNING_CERTIFICATES
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(
                    context.packageName,
                    PackageManager.GET_SIGNATURES
                )
            }

            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.signingInfo?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }

            val cert = signatures?.firstOrNull()?.toByteArray() ?: return "Unknown"
            val md = MessageDigest.getInstance("SHA-1")
            val digest = md.digest(cert)
            digest.joinToString(":") { String.format("%02X", it) }
        } catch (e: Exception) {
            "Unknown"
        }
    }

    @PluginMethod
    fun signIn(call: PluginCall) {
        val serverClientId = call.getString("clientId")
            ?: "468945089786-lj8p9tcr9m5ajjgbm5horon7pk8ln3rb.apps.googleusercontent.com"

        activity.runOnUiThread {
            try {
                val client = getClient(serverClientId)
                googleSignInClient = client

                // Sign out previous cache so user can choose an account on device
                client.signOut().addOnCompleteListener {
                    val signInIntent = client.signInIntent
                    startActivityForResult(call, signInIntent, "handleSignInResult")
                }
            } catch (e: Exception) {
                call.reject("Failed to initialize Google Sign-In: ${e.message}", e)
            }
        }
    }

    @ActivityCallback
    fun handleSignInResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode == Activity.RESULT_CANCELED) {
            val res = JSObject().apply {
                put("cancelled", true)
            }
            call.resolve(res)
            return
        }

        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account: GoogleSignInAccount = task.getResult(ApiException::class.java)
            val idToken = account.idToken
            if (idToken.isNullOrEmpty()) {
                val sha1 = getAppCertificateSha1()
                val errorMsg = "Google Sign-In succeeded but no ID token was returned. Make sure the APK SHA-1 ($sha1) is registered in Firebase Console for package ${activity.packageName}."
                android.util.Log.e("NativeGoogleAuth", errorMsg)
                call.reject(errorMsg, "NO_ID_TOKEN")
                return
            }

            val res = JSObject().apply {
                put("cancelled", false)
                put("idToken", idToken)
                put("email", account.email)
                put("displayName", account.displayName)
                put("photoUrl", account.photoUrl?.toString())
                put("id", account.id)
            }
            call.resolve(res)
        } catch (e: ApiException) {
            // CommonStatusCodes.SIGN_IN_REQUIRED or 12501 (cancelled by user)
            if (e.statusCode == CommonStatusCodes.SIGN_IN_REQUIRED ||
                e.statusCode == CommonStatusCodes.CANCELED ||
                e.statusCode == 12501
            ) {
                val res = JSObject().apply {
                    put("cancelled", true)
                }
                call.resolve(res)
            } else if (e.statusCode == CommonStatusCodes.DEVELOPER_ERROR || e.statusCode == 10) {
                val sha1 = getAppCertificateSha1()
                val errorMsg = "Google Sign-In Developer Error (Status 10): The APK SHA-1 fingerprint ($sha1) is not added in Firebase Console for package ${activity.packageName}. Please add this SHA-1 fingerprint under Firebase Console -> Project Settings -> Your Apps."
                android.util.Log.e("NativeGoogleAuth", errorMsg)
                call.reject(errorMsg, "DEVELOPER_ERROR_10")
            } else {
                val errorMsg = "Google Sign-In failed (status code ${e.statusCode}): ${e.message ?: "Unknown error"}"
                android.util.Log.e("NativeGoogleAuth", errorMsg)
                call.reject(errorMsg, "STATUS_${e.statusCode}")
            }
        } catch (e: Exception) {
            call.reject("Google authentication error: ${e.message}", e)
        }
    }

    @PluginMethod
    fun getApkSha1(call: PluginCall) {
        val sha1 = getAppCertificateSha1()
        val res = JSObject().apply {
            put("sha1", sha1)
            put("packageName", activity.packageName)
        }
        call.resolve(res)
    }

    @PluginMethod
    fun signOut(call: PluginCall) {
        val client = googleSignInClient ?: getClient("468945089786-lj8p9tcr9m5ajjgbm5horon7pk8ln3rb.apps.googleusercontent.com")
        client.signOut().addOnCompleteListener {
            call.resolve()
        }
    }
}
