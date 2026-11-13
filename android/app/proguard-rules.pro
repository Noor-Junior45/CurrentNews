# Capacitor Plugin & R8 Full-Mode reflection rules
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class com.getcapacitor.annotation.** { *; }
-keep public class * extends com.getcapacitor.Plugin {
    *;
}
-keepclassmembers class * extends com.getcapacitor.Plugin {
    <init>(...);
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
}
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.getcapacitor.community.admob.** { *; }

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

# Keep WebView @JavascriptInterface notification navigation bridge in release builds
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class blog.currentnews.app.MainActivity$NotificationNavBridge {
    public *;
}
