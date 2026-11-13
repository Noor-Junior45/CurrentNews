package blog.currentnews.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

class CurrentNewsFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM token refreshed")
        try {
            // Forward refreshed token to Capacitor PushNotifications plugin ('registration' listener in JS)
            PushNotificationsPlugin.onNewToken(token)
        } catch (e: Throwable) {
            Log.w(TAG, "Could not forward refreshed token to Capacitor plugin: ${e.message}")
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        val data = remoteMessage.data

        // Support data-only messages (title, body, url, imageUrl in data map) as well as notification payloads
        val rawTitle = data["title"]?.takeIf { it.isNotBlank() }
            ?: remoteMessage.notification?.title?.takeIf { it.isNotBlank() }
            ?: getString(R.string.app_name)

        val rawBody = data["body"]?.takeIf { it.isNotBlank() }
            ?: remoteMessage.notification?.body?.takeIf { it.isNotBlank() }
            ?: if (data.isNotEmpty()) "Tap to read the latest update on Current News." else return

        val title = cleanNotificationText(rawTitle).ifBlank { getString(R.string.app_name) }
        val body = cleanNotificationText(rawBody).ifBlank { "Tap to read the latest update on Current News." }

        val rawUrl = data["url"]?.takeIf { it.isNotBlank() }
            ?: data["link"]?.takeIf { it.isNotBlank() }
            ?: remoteMessage.notification?.clickAction
            ?: "/"

        val imageUrl = data["imageUrl"]?.takeIf { it.isNotBlank() }
            ?: data["image"]?.takeIf { it.isNotBlank() }
            ?: remoteMessage.notification?.imageUrl?.toString()

        val targetPath = extractArticlePath(rawUrl)
        showNotification(title, body, rawUrl, targetPath, imageUrl)
    }

    private fun showNotification(
        title: String,
        body: String,
        rawUrl: String,
        targetPath: String,
        imageUrl: String?
    ) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        ensureChannelExists(notificationManager)

        val notificationId = ((System.currentTimeMillis() and 0x7FFFFFFF) % 1000000).toInt()

        // Launch or foreground MainActivity (singleTask) and pass target article path
        val intent = Intent(this, MainActivity::class.java).apply {
            action = ACTION_OPEN_NOTIFICATION_ARTICLE
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_TARGET_PATH, targetPath)
            putExtra(EXTRA_TARGET_URL, rawUrl)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)

        if (!imageUrl.isNullOrBlank()) {
            val bitmap = getBitmapFromUrl(imageUrl)
            if (bitmap != null) {
                notificationBuilder.setLargeIcon(bitmap)
                notificationBuilder.setStyle(
                    NotificationCompat.BigPictureStyle()
                        .bigPicture(bitmap)
                        .bigLargeIcon(null as Bitmap?)
                        .setSummaryText(body)
                )
            } else {
                notificationBuilder.setStyle(NotificationCompat.BigTextStyle().bigText(body))
            }
        } else {
            notificationBuilder.setStyle(NotificationCompat.BigTextStyle().bigText(body))
        }

        notificationManager.notify(notificationId, notificationBuilder.build())
    }

    private fun ensureChannelExists(notificationManager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val existing = notificationManager.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.channel_name),
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = getString(R.string.channel_description)
                    enableLights(true)
                    enableVibration(true)
                }
                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    private fun getBitmapFromUrl(imageUrl: String): Bitmap? {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL(imageUrl)
            connection = (url.openConnection() as HttpURLConnection).apply {
                doInput = true
                connectTimeout = 4000
                readTimeout = 4000
                connect()
            }
            val input: InputStream = connection.inputStream
            input.use { BitmapFactory.decodeStream(it) }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to download notification image bitmap: ${e.message}")
            null
        } finally {
            connection?.disconnect()
        }
    }

    companion object {
        private const val TAG = "FCM_CurrentNews"
        const val CHANNEL_ID = "breaking_news_channel"
        const val ACTION_OPEN_NOTIFICATION_ARTICLE = "blog.currentnews.app.OPEN_NOTIFICATION_ARTICLE"
        const val EXTRA_TARGET_PATH = "target_path"
        const val EXTRA_TARGET_URL = "target_url"

        /**
         * Strips HTML tags, figure markers, non-breaking spaces (&nbsp; / &nbsp / &#160; / \u00A0),
         * and HTML entities so Android system notifications always render clean human-readable text.
         */
        fun cleanNotificationText(raw: String?): String {
            if (raw.isNullOrBlank()) return ""
            var text = raw
                .replace(Regex("\\[fig(?:ure)?(?:\\.|\\s+)?\\s*\\d+[^\\]]*\\]", RegexOption.IGNORE_CASE), "")
                .replace(Regex("<[^>]*>"), " ")
                .replace(Regex("&amp;", RegexOption.IGNORE_CASE), "&")
                .replace(Regex("&nbsp;?|&#0*160;?|&#x0*a0;?|&(?:ensp|emsp|thinsp);?", RegexOption.IGNORE_CASE), " ")
                .replace(Regex("&quot;|&ldquo;|&rdquo;", RegexOption.IGNORE_CASE), "\"")
                .replace(Regex("&#0*39;|&apos;|&lsquo;|&rsquo;", RegexOption.IGNORE_CASE), "'")
                .replace(Regex("&ndash;", RegexOption.IGNORE_CASE), "–")
                .replace(Regex("&mdash;", RegexOption.IGNORE_CASE), "—")
                .replace(Regex("&hellip;", RegexOption.IGNORE_CASE), "…")
                .replace(Regex("&lt;", RegexOption.IGNORE_CASE), "<")
                .replace(Regex("&gt;", RegexOption.IGNORE_CASE), ">")

            text = Regex("&#(\\d+);").replace(text) { match ->
                val cp = match.groupValues[1].toIntOrNull()
                if (cp != null && cp in 32..0x10FFFF) {
                    if (cp == 160) " " else String(Character.toChars(cp))
                } else {
                    ""
                }
            }

            text = Regex("&#x([0-9a-fA-F]+);", RegexOption.IGNORE_CASE).replace(text) { match ->
                val cp = match.groupValues[1].toIntOrNull(16)
                if (cp != null && cp in 32..0x10FFFF) {
                    if (cp == 0xA0) " " else String(Character.toChars(cp))
                } else {
                    ""
                }
            }

            return text
                .replace('\u00A0', ' ')
                .replace("\u200B", "")
                .replace(Regex("\\s+"), " ")
                .trim()
        }

        /**
         * Extracts the SPA route path (plus optional query/fragment) from a full URL or relative path,
         * e.g. "https://currentnews.blog/post/123/my-slug" -> "/post/123/my-slug".
         */
        fun extractArticlePath(rawUrl: String?): String {
            val trimmed = rawUrl?.trim().orEmpty()
            if (trimmed.isEmpty()) return "/"
            if (trimmed.startsWith("/")) return trimmed

            return try {
                val uri = Uri.parse(trimmed)
                val path = uri.encodedPath?.takeIf { it.isNotEmpty() } ?: "/"
                val query = uri.encodedQuery?.takeIf { it.isNotEmpty() }?.let { "?$it" } ?: ""
                val fragment = uri.encodedFragment?.takeIf { it.isNotEmpty() }?.let { "#$it" } ?: ""
                val combined = "$path$query$fragment"
                if (combined.startsWith("/")) combined else "/$combined"
            } catch (_: Exception) {
                "/"
            }
        }
    }
}
