# 91DAB Dashboard Android App

This native Android wrapper is a fixed shortcut to the protected 91DAB dashboard at `https://dab-1-cizz.onrender.com/admin`. On launch it opens the website’s existing username/email-and-password login directly—there is **no URL-entry screen** and it does not contain the dashboard password, UPI VPA, database credentials, JWT secret, or Resend API key. The WebView accepts only HTTPS navigation on the fixed 91DAB host; `mailto:` and `tel:` links are handed to Android.

The generated debug APK is suitable for direct installation and testing. Build it with:

```bash
ANDROID_SDK_ROOT=/path/to/android-sdk ./build-apk.sh
```

For a production release, keep the signing key outside the repository and provide it only to the secure build environment:

```bash
APK_BUILD_MODE=release \
ANDROID_RELEASE_KEYSTORE=/secure/path/91dab-release.keystore \
ANDROID_RELEASE_KEY_ALIAS=91dab-release \
ANDROID_RELEASE_STORE_PASSWORD='...' \
ANDROID_RELEASE_KEY_PASSWORD='...' \
ANDROID_SDK_ROOT=/path/to/android-sdk \
./build-apk.sh
```

The release APK is written to `build/91dab-dashboard-release.apk`. Increment `versionCode` in `app/build.gradle.kts` before every future production update.
