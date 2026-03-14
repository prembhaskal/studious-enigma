# VS Code Android Extension - Feature List

## Goal
Lightweight Android development workflow for VS Code — targeting developers on low-end machines who want to skip Android Studio and the emulator overhead.

## Out of Scope
- Code intelligence / autocomplete (use Kotlin extension separately)
- XML layout preview
- Android resource management

---

## Build Stages (Priority Order)

| Stage | Feature |
|-------|---------|
| Stage 1 | Build (Gradle) |
| Stage 2 | Device Connection (ADB) |
| Stage 3 | Run App on Device |
| Stage 4 | Logcat Viewer |
| Stage 5 | Project Scaffolding |

---

## Locked Features

### 1. Project Scaffolding
- Generate a new Android project from templates
- Options to select:
  - Language: Kotlin / Java
  - Minimum SDK version
  - Project type: Empty Activity / No Activity
- Generates standard structure: `app/src/`, `build.gradle`, `settings.gradle`, `AndroidManifest.xml`, `gradle/wrapper/`

### 2. Build
- Run Gradle build from within VS Code
- Options:
  - Debug build (`./gradlew assembleDebug`)
  - Release build (`./gradlew assembleRelease`)
- Output streamed to VS Code terminal panel
- Show success/failure status in status bar

### 3. Device Connection (ADB)
- List connected devices (`adb devices`)
- Connect to device over WiFi (`adb connect <ip:port>`)
- Disconnect device
- Show connected device info in status bar

### 4. Run App on Device
- Install APK on selected device (`adb install`)
- Launch the app after install (`adb shell am start`)
- Target device selector if multiple devices connected

### 5. Logcat Viewer
- Stream logs from connected device (`adb logcat`)
- Filter logs by app package name
- Filter by log level (Verbose / Debug / Info / Warn / Error)
- Display in a dedicated VS Code output panel
- Clear logs button

---

## Assumptions
- User has Android SDK + ADB installed and on PATH
- User has Java/JDK installed
- Gradle wrapper (`gradlew`) is used — no global Gradle required
- Testing is done on a real physical device, not emulator
