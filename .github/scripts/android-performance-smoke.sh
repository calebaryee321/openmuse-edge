#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${1:?APK path is required}"
OUT_DIR="${RUNNER_TEMP:?RUNNER_TEMP is required}/android-performance"
PACKAGE="app.openmuse.mobile"
ACTIVITY="$PACKAGE/.MainActivity"

mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/performance-report.txt"
: > "$REPORT"

echo "OpenMuse Edge Android performance smoke" | tee -a "$REPORT"
echo "APK: $APK_PATH" | tee -a "$REPORT"
echo "APK bytes: $(stat -c%s "$APK_PATH")" | tee -a "$REPORT"

adb install -r "$APK_PATH" >/dev/null

echo "" | tee -a "$REPORT"
echo "Cold-start timings (ms)" | tee -a "$REPORT"
for i in 1 2 3; do
  adb shell am force-stop "$PACKAGE"
  sleep 2
  START_OUTPUT="$(adb shell am start -W -n "$ACTIVITY")"
  echo "$START_OUTPUT" > "$OUT_DIR/cold-start-$i.txt"
  TOTAL="$(printf '%s\n' "$START_OUTPUT" | awk -F': ' '/TotalTime:/ {gsub("\r","",$2); print $2}')"
  WAIT="$(printf '%s\n' "$START_OUTPUT" | awk -F': ' '/WaitTime:/ {gsub("\r","",$2); print $2}')"
  THIS="$(printf '%s\n' "$START_OUTPUT" | awk -F': ' '/ThisTime:/ {gsub("\r","",$2); print $2}')"
  echo "run $i: ThisTime=${THIS:-n/a} TotalTime=${TOTAL:-n/a} WaitTime=${WAIT:-n/a}" | tee -a "$REPORT"
  sleep 3
done

PID="$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)"
if [[ -z "$PID" ]]; then
  echo "FAIL: OpenMuse process is not alive after cold-start loop." | tee -a "$REPORT"
  exit 1
fi

echo "" | tee -a "$REPORT"
echo "Process PID: $PID" | tee -a "$REPORT"

adb shell dumpsys meminfo "$PACKAGE" > "$OUT_DIR/meminfo.txt"
adb shell dumpsys cpuinfo > "$OUT_DIR/cpuinfo.txt"
adb shell dumpsys gfxinfo "$PACKAGE" framestats > "$OUT_DIR/gfxinfo.txt"
adb logcat -d > "$OUT_DIR/logcat.txt"

PSS="$(awk '/TOTAL PSS:/ {print $3; exit} /^ *TOTAL +[0-9]/ {print $2; exit}' "$OUT_DIR/meminfo.txt")"
RSS="$(awk '/TOTAL RSS:/ {print $3; exit}' "$OUT_DIR/meminfo.txt")"
CPU_LINE="$(grep "$PACKAGE" "$OUT_DIR/cpuinfo.txt" | head -n 1 || true)"
JANK="$(grep -m1 'Janky frames:' "$OUT_DIR/gfxinfo.txt" || true)"
TOTAL_FRAMES="$(grep -m1 'Total frames rendered:' "$OUT_DIR/gfxinfo.txt" || true)"

echo "Memory TOTAL PSS (KB): ${PSS:-n/a}" | tee -a "$REPORT"
echo "Memory TOTAL RSS (KB): ${RSS:-n/a}" | tee -a "$REPORT"
echo "CPU snapshot: ${CPU_LINE:-n/a}" | tee -a "$REPORT"
echo "Frames: ${TOTAL_FRAMES:-n/a}" | tee -a "$REPORT"
echo "Jank: ${JANK:-n/a}" | tee -a "$REPORT"

echo "" | tee -a "$REPORT"
echo "Repeated-launch stability" | tee -a "$REPORT"
for i in 1 2 3 4 5; do
  adb shell am force-stop "$PACKAGE"
  adb shell am start -n "$ACTIVITY" >/dev/null
  sleep 3
  PID="$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)"
  if [[ -z "$PID" ]]; then
    echo "FAIL: process died on relaunch $i" | tee -a "$REPORT"
    exit 1
  fi
  echo "relaunch $i: alive (PID $PID)" | tee -a "$REPORT"
done

adb logcat -d > "$OUT_DIR/logcat-after-relaunch.txt"
if grep -E 'FATAL EXCEPTION:|AndroidRuntime:.*Process: app\.openmuse\.mobile|Fatal signal.*app\.openmuse\.mobile' "$OUT_DIR/logcat-after-relaunch.txt"; then
  echo "FAIL: fatal app crash found during performance smoke." | tee -a "$REPORT"
  exit 1
fi

echo "PASS: app shell survived performance smoke." | tee -a "$REPORT"
