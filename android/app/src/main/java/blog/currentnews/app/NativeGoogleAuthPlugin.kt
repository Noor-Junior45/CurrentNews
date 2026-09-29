package blog.currentnews.app

import android.app.Activity
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
    private fun handleSignInResult(call: PluginCall, result: ActivityResult) {
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
                call.reject("Google Sign-In succeeded but no ID token was returned. Please check SHA-1 fingerprint.")
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
            } else {
                call.reject("Google Sign-In failed (status code ${e.statusCode}): ${e.message}", e)
            }
        } catch (e: Exception) {
            call.reject("Google authentication error: ${e.message}", e)
        }
    }

    @PluginMethod
    fun signOut(call: PluginCall) {
        val client = googleSignInClient ?: getClient("468945089786-lj8p9tcr9m5ajjgbm5horon7pk8ln3rb.apps.googleusercontent.com")
        client.signOut().addOnCompleteListener {
            call.resolve()
        }
    }
}
