#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${1:?APK path is required}"
OUT_DIR="${RUNNER_TEMP:?RUNNER_TEMP is required}/android-smoke"
PACKAGE="app.openmuse.mobile"

mkdir -p "$OUT_DIR"

echo "Installing $APK_PATH"
adb install -r "$APK_PATH"

adb logcat -c
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1
sleep 25

adb logcat -d > "$OUT_DIR/logcat.txt"
adb shell dumpsys activity activities > "$OUT_DIR/activity.txt"

PID="$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)"
if [[ -z "$PID" ]]; then
  echo "OpenMuse process exited after launch."
  grep -E 'FATAL EXCEPTION:|AndroidRuntime|Fatal signal|Abort message|Process: app\.openmuse\.mobile|ReactNativeJS' "$OUT_DIR/logcat.txt" || true
  exit 1
fi

echo "OpenMuse PID: $PID"

adb shell uiautomator dump /sdcard/openmuse-ui.xml
adb pull /sdcard/openmuse-ui.xml "$OUT_DIR/openmuse-ui.xml"

# GitHub's unaccelerated Android emulator can occasionally ANR System UI after
# boot/install. That is emulator infrastructure, not an OpenMuse crash. Dismiss
# the overlay once, then re-capture the app UI.
if grep -q "System UI isn't responding" "$OUT_DIR/openmuse-ui.xml"; then
  echo "System UI ANR overlay detected; dismissing emulator-only dialog."
  adb shell input keyevent 4 || true
  sleep 5
  adb shell uiautomator dump /sdcard/openmuse-ui.xml
  adb pull /sdcard/openmuse-ui.xml "$OUT_DIR/openmuse-ui.xml"
fi

adb exec-out screencap -p > "$OUT_DIR/openmuse-screen.png"

test -s "$OUT_DIR/openmuse-screen.png"
test -s "$OUT_DIR/openmuse-ui.xml"

if grep -E 'FATAL EXCEPTION:|AndroidRuntime:.*Process: app\.openmuse\.mobile|Fatal signal.*app\.openmuse\.mobile' "$OUT_DIR/logcat.txt"; then
  echo "OpenMuse crashed during standalone installed-app smoke test."
  exit 1
fi

grep -Eq 'Welcome to OpenMuse|Open workspace|A little room for your day|Open Device AI' "$OUT_DIR/openmuse-ui.xml"

echo "Standalone APK launch QA passed."
