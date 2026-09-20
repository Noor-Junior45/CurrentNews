// Top-level build file for Kotlin DSL (build.gradle.kts)
plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
    // Google Services Gradle plugin for Firebase SDKs
    id("com.google.gms.google-services") version "4.4.1" apply false
    // Firebase Crashlytics Gradle plugin
    id("com.google.firebase.crashlytics") version "2.9.9" apply false
}
