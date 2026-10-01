# Capacitor Plugin reflection rules
-keep public class * extends com.getcapacitor.Plugin {
    public *;
}
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
    @com.getcapacitor.annotation.ActivityCallback public *;
    @com.getcapacitor.annotation.PermissionCallback public *;
}

# Keep NativeGoogleAuthPlugin specifically
-keep class blog.currentnews.app.NativeGoogleAuthPlugin {
    public *;
}
-keepclassmembers class blog.currentnews.app.NativeGoogleAuthPlugin {
    public *;
}

# Google Play Services Auth
-keep class com.google.android.gms.auth.api.signin.** { *; }
-keep class com.google.android.gms.common.api.** { *; }
