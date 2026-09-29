import java.io.File
import java.util.Properties

// Module-level build file for Kotlin DSL (app/build.gradle.kts)
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // Google services Gradle plugin for Firebase
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
}

android {
    namespace = "blog.currentnews.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "blog.currentnews.app"
        minSdk = 33 // Android 13 (Tiramisu) and above
        targetSdk = 36 // Android 16 / API 36
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            if (keystorePropertiesFile.exists()) {
                val properties = Properties()
                keystorePropertiesFile.inputStream().use { stream ->
                    properties.load(stream)
                }
                val storeFilePath: String = properties.getProperty("storeFile") ?: "currentnews-release-key.jks"
                val file = File(storeFilePath)
                storeFile = if (file.isAbsolute) file else rootProject.file(storeFilePath)
                storePassword = properties.getProperty("storePassword") ?: ""
                keyAlias = properties.getProperty("keyAlias") ?: "currentnews"
                keyPassword = properties.getProperty("keyPassword") ?: ""
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val releaseSigning = signingConfigs.getByName("release")
            if (releaseSigning.storeFile != null && releaseSigning.storeFile!!.exists()) {
                signingConfig = releaseSigning
            }
            firebaseCrashlytics {
                mappingFileUploadEnabled = true
            }
        }
        debug {
            isDebuggable = true
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    // Force AndroidX versions compatible with AGP 8.7.2 to prevent AAR metadata errors
    constraints {
        implementation("androidx.core:core:1.15.0") {
            because("androidx.core 1.17.0 requires AGP 8.9.1+")
        }
        implementation("androidx.core:core-ktx:1.15.0") {
            because("androidx.core-ktx 1.17.0 requires AGP 8.9.1+")
        }
        implementation("androidx.activity:activity:1.9.3") {
            because("androidx.activity 1.11.0 requires AGP 8.9.1+")
        }
        implementation("androidx.activity:activity-ktx:1.9.3") {
            because("androidx.activity-ktx 1.11.0 requires AGP 8.9.1+")
        }
    }

    // Capacitor Android Core Bridge
    implementation(project(":capacitor-android"))

    // AndroidX & UI (Targeted for Android 13+ / API 33-36)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.activity:activity-ktx:1.9.3")

    // Firebase Platform (BoM manages versions)
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))

    // Firebase SDKs
    implementation("com.google.firebase:firebase-crashlytics-ktx")
    implementation("com.google.firebase:firebase-analytics-ktx")
    implementation("com.google.firebase:firebase-messaging-ktx")

    // Google Play Services Auth (Native device account picker & Google Sign-In)
    implementation("com.google.android.gms:play-services-auth:21.3.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
