# Developer Guide — android-helper

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Build toolchain |
| npm | 9+ | Package manager |
| VS Code | 1.110+ | Extension host |
| Android SDK | Any | ADB binary (`adb` on PATH) |
| JDK | 11+ | Required to run Gradle |

Verify your setup:
```bash
node --version
adb version
java -version
```

---

## Project Structure

```
android-helper/
├── src/
│   ├── extension.ts   # Entry point, command registrations, status bar
│   ├── adb.ts         # ADB command wrappers (list, connect, install, launch)
│   ├── android.ts     # APK finder, AndroidManifest.xml parser
│   └── logcat.ts      # Logcat streaming session
├── out/               # Compiled JS (generated, not committed)
├── package.json       # Extension manifest and commands
└── tsconfig.json      # TypeScript config
```

---

## Build

Install dependencies (first time only):
```bash
cd vscode/extensions/android-helper
npm install
```

Compile TypeScript:
```bash
npm run compile
```

Watch mode (recompiles on save):
```bash
npm run watch
```

Lint:
```bash
npm run lint
```

---

## Run & Test Locally (Extension Development Host)

1. Open the `android-helper` folder in VS Code:
   ```bash
   code vscode/extensions/android-helper
   ```

2. Press `F5` — this launches a new **Extension Development Host** window with the extension loaded.

3. In the new window, open an Android project folder.

4. Open the Command Palette (`Cmd+Shift+P` on macOS / `Ctrl+Shift+P` on Windows/Linux) and type `Android:` to see all available commands.

### Available Commands

| Command | What it does |
|---------|-------------|
| `Android: Build` | Runs `./gradlew assembleDebug` or `assembleRelease` |
| `Android: Connect Device` | Connects a device over WiFi via `adb connect <ip:port>` |
| `Android: Disconnect Device` | Disconnects a selected ADB device |
| `Android: Select Device` | Sets the active device for Run/Logcat |
| `Android: Run App on Device` | Installs APK and launches app on selected device |
| `Android: Start Logcat` | Streams device logs to the Android Logcat output panel |
| `Android: Stop Logcat` | Stops the logcat stream |
| `Android: Clear Logcat` | Clears the logcat output panel |

### Status Bar

Two items appear in the bottom status bar:
- `$(tools) Android Build` — click to trigger a build
- `$(device-mobile) <device name>` — click to select/change the active device

---

## Manual Testing Checklist

### Build
- [ ] Open an Android project (with `gradlew`) in the Extension Development Host
- [ ] Run `Android: Build` → select Debug → verify terminal opens and Gradle runs
- [ ] Run `Android: Build` → select Release → verify `assembleRelease` runs
- [ ] Open a non-Android folder → run `Android: Build` → verify error message about missing `gradlew`

### Device Connection
- [ ] Connect a physical Android device via USB or enable wireless ADB
- [ ] Run `Android: Select Device` → verify device appears in picker
- [ ] Run `Android: Connect Device` with a valid IP:port → verify success message
- [ ] Run `Android: Connect Device` with invalid address → verify error message
- [ ] Run `Android: Disconnect Device` → verify device disconnects and status bar updates
- [ ] Verify status bar shows device name after selection and `No device` after disconnect

### Run App
- [ ] Select a device, then run `Android: Run App on Device`
- [ ] Select Debug → verify APK is installed and app launches on device
- [ ] Delete the APK (`app/build/outputs/apk/debug/`) → run again → verify "Build Now" prompt appears
- [ ] Without a device selected → run command → verify "Select Device" prompt appears

### Logcat
- [ ] With device selected, run `Android: Start Logcat` → select a log level
- [ ] Select "Yes — App only" for package filter → verify logs are filtered to the app's PID
- [ ] Select "No — All logs" → verify all device logs stream in
- [ ] Run `Android: Clear Logcat` → verify output panel clears
- [ ] Run `Android: Stop Logcat` → verify stream stops
- [ ] Run `Android: Stop Logcat` when not running → verify info message shown

---

## Package for Distribution

Install the VS Code extension packaging tool:
```bash
npm install -g @vscode/vsce
```

Package as `.vsix`:
```bash
vsce package
```

This produces `android-helper-0.0.1.vsix`.

---

## Install from VSIX

To install the packaged extension manually in VS Code:

**Via Command Palette:**
1. `Cmd+Shift+P` → `Extensions: Install from VSIX...`
2. Select the `.vsix` file

**Via CLI:**
```bash
code --install-extension android-helper-0.0.1.vsix
```

To uninstall:
```bash
code --uninstall-extension android-helper
```
