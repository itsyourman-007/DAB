#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SDK_ROOT="${ANDROID_SDK_ROOT:-/home/ubuntu/android-sdk}"
BUILD_TOOLS="$SDK_ROOT/build-tools/35.0.0"
ANDROID_JAR="$SDK_ROOT/platforms/android-35/android.jar"
OUT="$ROOT/build"
UNSIGNED="$OUT/91dab-dashboard-unsigned.apk"
ALIGNED="$OUT/91dab-dashboard-aligned.apk"
MODE="${APK_BUILD_MODE:-debug}"
APK="$OUT/91dab-dashboard-${MODE}.apk"

for required in "$BUILD_TOOLS/aapt2" "$BUILD_TOOLS/d8" "$BUILD_TOOLS/zipalign" "$BUILD_TOOLS/apksigner" "$ANDROID_JAR"; do
  [ -e "$required" ] || { echo "Missing Android SDK component: $required" >&2; exit 1; }
done

rm -rf "$OUT/classes" "$OUT/dex" "$OUT/gen" "$OUT/resources.zip" "$UNSIGNED" "$ALIGNED" "$APK"
mkdir -p "$OUT/classes" "$OUT/dex"

"$BUILD_TOOLS/aapt2" compile --dir "$ROOT/app/src/main/res" -o "$OUT/resources.zip"
"$BUILD_TOOLS/aapt2" link -o "$UNSIGNED" -I "$ANDROID_JAR" --manifest "$ROOT/app/src/main/AndroidManifest.xml" -R "$OUT/resources.zip" --java "$OUT/gen" --auto-add-overlay --min-sdk-version 24 --target-sdk-version 35

javac --release 8 -classpath "$ANDROID_JAR" -d "$OUT/classes" "$OUT/gen/com/dantaresearch/dabdashboard/R.java" "$ROOT/app/src/main/java/com/dantaresearch/dabdashboard/MainActivity.java"
mapfile -t CLASS_FILES < <(find "$OUT/classes" -type f -name '*.class' | sort)
"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 24 --output "$OUT/dex" "${CLASS_FILES[@]}"
(cd "$OUT/dex" && zip -q "$UNSIGNED" classes.dex)

"$BUILD_TOOLS/zipalign" -f 4 "$UNSIGNED" "$ALIGNED"
if [ "$MODE" = "release" ]; then
  : "${ANDROID_RELEASE_KEYSTORE:?Set ANDROID_RELEASE_KEYSTORE to your release keystore path}"
  : "${ANDROID_RELEASE_KEY_ALIAS:?Set ANDROID_RELEASE_KEY_ALIAS to your release key alias}"
  : "${ANDROID_RELEASE_STORE_PASSWORD:?Set ANDROID_RELEASE_STORE_PASSWORD securely in the build environment}"
  : "${ANDROID_RELEASE_KEY_PASSWORD:?Set ANDROID_RELEASE_KEY_PASSWORD securely in the build environment}"
  "$BUILD_TOOLS/apksigner" sign --ks "$ANDROID_RELEASE_KEYSTORE" --ks-pass env:ANDROID_RELEASE_STORE_PASSWORD --key-pass env:ANDROID_RELEASE_KEY_PASSWORD --ks-key-alias "$ANDROID_RELEASE_KEY_ALIAS" --out "$APK" "$ALIGNED"
elif [ "$MODE" = "debug" ]; then
  KEYSTORE="$OUT/91dab-debug.keystore"
  if [ ! -f "$KEYSTORE" ]; then
    keytool -genkeypair -keystore "$KEYSTORE" -storepass android -keypass android -alias 91dab-debug -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=91DAB Debug, OU=Merchant Dashboard, O=91DAB, L=Bengaluru, ST=Karnataka, C=IN"
  fi
  "$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android --ks-key-alias 91dab-debug --out "$APK" "$ALIGNED"
else
  echo "APK_BUILD_MODE must be debug or release" >&2
  exit 1
fi
"$BUILD_TOOLS/apksigner" verify --verbose "$APK"
echo "APK created: $APK"
