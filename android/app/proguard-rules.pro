# Preserve actionable crash traces; Capacitor and Unity ship their own consumer rules.
-keepattributes SourceFile,LineNumberTable

# Facebook sign-in is not configured or packaged. Firebase Auth's optional
# provider handler references these types behind its disabled-provider guard.
-dontwarn com.facebook.CallbackManager
-dontwarn com.facebook.CallbackManager$Factory
-dontwarn com.facebook.FacebookCallback
-dontwarn com.facebook.login.LoginManager
-dontwarn com.facebook.login.widget.LoginButton

# Capacitor reads @CapacitorPlugin / @Permission annotations at runtime (plugin
# registration and checkPermissions/requestPermissions). In 1.3.110 R8 dropped them and
# LocalNotifications.checkPermissions crashed the app ~3 s after launch with an NPE in
# Bridge.getPermissionStates (2026-10-15). Keep the annotation types and their attributes.
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,AnnotationDefault,Signature,InnerClasses,EnclosingMethod
-keep @interface com.getcapacitor.annotation.** { *; }
-keep @interface com.getcapacitor.NativePlugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# JavaScript bridges are invoked by WebView rather than ordinary Java calls.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
