# Vendored Android compatibility patch

Source: flutter_inappwebview_android 1.1.3 from pub.dev (upstream flutter_inappwebview 6.1.5).
The upstream LICENSE is retained. Java and Dart implementation are unchanged.

Only Android build.gradle is patched: both default ProGuard file references use
proguard-android-optimize.txt. AGP 9.1 rejects the upstream proguard-android.txt
at configuration time, including debug builds. This local dependency override
makes the fix reproducible without editing a developer's global pub cache.

Remove this override when a compatible stable upstream Android plugin is available.
