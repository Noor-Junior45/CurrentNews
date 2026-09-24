package blog.currentnews.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.messaging.FirebaseMessaging

class CurrentNewsApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // 1. Initialize Firebase Crashlytics
        val crashlytics = FirebaseCrashlytics.getInstance()
        crashlytics.setCrashlyticsCollectionEnabled(true)
        crashlytics.setCustomKey("app_variant", "native_android")
        crashlytics.setCustomKey("target_sdk", 36)

        // 2. Set up Breaking News Notification Channel (Android O+)
        createNotificationChannels()

        // 3. Automatically subscribe to breaking news topics for push notifications
        subscribeToNewsTopics()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = "breaking_news_channel"
            val channelName = getString(R.string.channel_name)
            val channelDescription = getString(R.string.channel_description)
            val importance = NotificationManager.IMPORTANCE_HIGH

            val channel = NotificationChannel(channelId, channelName, importance).apply {
                description = channelDescription
                enableLights(true)
                enableVibration(true)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun subscribeToNewsTopics() {
        FirebaseMessaging.getInstance().subscribeToTopic("all_posts")
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    Log.d("CurrentNewsApp", "Subscribed to all_posts topic for news alerts")
                }
            }
        FirebaseMessaging.getInstance().subscribeToTopic("breaking_news")
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    Log.d("CurrentNewsApp", "Subscribed to breaking_news topic")
                }
            }
    }
}
