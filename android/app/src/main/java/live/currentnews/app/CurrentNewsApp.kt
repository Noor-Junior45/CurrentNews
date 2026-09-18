package live.currentnews.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.google.firebase.crashlytics.FirebaseCrashlytics

class CurrentNewsApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // 1. Initialize Firebase Crashlytics
        val crashlytics = FirebaseCrashlytics.getInstance()
        crashlytics.setCrashlyticsCollectionEnabled(true)
        crashlytics.setCustomKey("app_variant", "native_android")
        crashlytics.setCustomKey("target_sdk", 34)

        // 2. Set up Breaking News Notification Channel (Android O+)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = "breaking_news_channel"
            val channelName = getString(R.string.channel_name)
            val channelDescription = getString(R.string.channel_description)
            val importance = NotificationManager.IMPORTANCE_DEFAULT

            val channel = NotificationChannel(channelId, channelName, importance).apply {
                description = channelDescription
                enableLights(true)
                enableVibration(true)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
