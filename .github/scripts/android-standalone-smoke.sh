#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${1:?APK path is required}"
OUT_DIR="${RUNNER_TEMP:?RUNNER_TEMP is required}/android-smoke"
PACKAGE="app.openmuse.mobile"

mkdir -p "$OUT_DIR"

collect_install_diagnostics() {
  adb get-state > "$OUT_DIR/adb-state.txt" 2>&1 || true
  adb shell getprop sys.boot_completed > "$OUT_DIR/boot-completed.txt" 2>&1 || true
  adb shell service list > "$OUT_DIR/services.txt" 2>&1 || true
  adb shell dumpsys package > "$OUT_DIR/package-manager.txt" 2>&1 || true
  adb logcat -d > "$OUT_DIR/prelaunch-logcat.txt" 2>&1 || true
}

echo "Waiting for Android device..."
adb wait-for-device

echo "Waiting for Android boot completion..."
for attempt in $(seq 1 60); do
  if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    break
  fi
  if [[ "$attempt" == "60" ]]; then
    echo "Android did not report boot completion."
    collect_install_diagnostics
    exit 1
  fi
  sleep 5
done

echo "Waiting for Package Manager readiness..."
for attempt in $(seq 1 60); do
  if adb shell cmd package list packages >/dev/null 2>&1; then
    echo "Package Manager ready on attempt $attempt."
    break
  fi
  if [[ "$attempt" == "60" ]]; then
    echo "Package Manager never became responsive."
    collect_install_diagnostics
    exit 1
  fi
  sleep 5
done

echo "Installing $APK_PATH"
installed=0
for attempt in $(seq 1 5); do
  echo "APK install attempt $attempt/5"
  if adb install -r "$APK_PATH" 2>&1 | tee "$OUT_DIR/install-attempt-$attempt.txt"; then
    installed=1
    break
  fi

  # Package Manager on slow GitHub emulators can transiently disconnect even
  # after sys.boot_completed=1. Reconnect and verify the service before retry.
  adb reconnect >/dev/null 2>&1 || true
  adb wait-for-device || true
  for ready in $(seq 1 12); do
    adb shell cmd package list packages >/dev/null 2>&1 && break
    sleep 5
  done
  sleep 5
done

if [[ "$installed" != "1" ]]; then
  echo "APK installation failed after retries."
  collect_install_diagnostics
  exit 1
fi

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
echo "$PID" > "$OUT_DIR/pid-initial.txt"

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

if grep -E 'FATAL EXCEPTION:|AndroidRuntime:.*Process: app\.openmuse\.mobile|Fatal signal.*app\.openmuse\.mobile|Abort message:.*openmuse' "$OUT_DIR/logcat.txt"; then
  echo "OpenMuse crashed during standalone installed-app smoke test."
  exit 1
fi

grep -Eq 'Welcome to OpenMuse|Open workspace|A little room for your day|Open Device AI' "$OUT_DIR/openmuse-ui.xml"

# Detect silent process recreation after the first render. A crash/restart can
# otherwise look like a harmless navigation bounce back to the menu.
sleep 10
PID_AFTER="$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)"
echo "$PID_AFTER" > "$OUT_DIR/pid-after-render.txt"
if [[ -z "$PID_AFTER" || "$PID_AFTER" != "$PID" ]]; then
  echo "OpenMuse process changed after initial render: before=$PID after=$PID_AFTER"
  adb logcat -d > "$OUT_DIR/logcat-after-render.txt" || true
  exit 1
fi

echo "Standalone APK launch QA passed with stable process $PID."
