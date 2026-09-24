// Top-level build file for Kotlin DSL (build.gradle.kts)
plugins {
    id("com.android.application") version "8.7.2" apply false
    id("com.android.library") version "8.7.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.0" apply false
    // Google Services Gradle plugin for Firebase SDKs
    id("com.google.gms.google-services") version "4.4.2" apply false
    // Firebase Crashlytics Gradle plugin
    id("com.google.firebase.crashlytics") version "3.0.2" apply false
}

// Extra properties consumed by Capacitor subprojects
extra["androidxCoreVersion"] = "1.15.0"
extra["androidxActivityVersion"] = "1.9.3"
extra["androidxFragmentVersion"] = "1.8.5"
extra["androidxAppCompatVersion"] = "1.7.0"
extra["androidxWebkitVersion"] = "1.12.1"
extra["androidxCoordinatorLayoutVersion"] = "1.3.0"


