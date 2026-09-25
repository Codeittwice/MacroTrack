# Testing the Android app on this PC

The Android app is the same web build wrapped by Capacitor, so most testing happens in the browser.
Use the emulator for anything native: the camera, barcode scanning, notifications and the WebView itself.

## Level 1 — browser (every change)
- `npm run dev`, then open http://localhost:5173 with a phone viewport (Chrome DevTools → device toolbar → Pixel 7).
- `npm run e2e` runs Playwright in both the `desktop` and `mobile` (Pixel 7) projects.

## Level 2 — Android emulator (real Android WebView)

### One-time setup
1. Install **Android Studio** (https://developer.android.com/studio) and **JDK 21**. This project uses Gradle 8.11, which cannot run on Android Studio 2026's bundled Java 25 runtime.
2. In Android Studio's SDK Manager, install:
   - Android SDK Platform 35
   - Android SDK Build-Tools
   - Android Emulator
   - Android SDK Platform-Tools
3. Device Manager → Create device → **Pixel 7**, system image **API 35 x86_64** (Google APIs).
4. Windows: turn on **Windows Hypervisor Platform** (Windows Features) so the emulator is hardware-accelerated.
5. Set these environment variables, then restart the terminal:
   - `ANDROID_HOME = %LOCALAPPDATA%\Android\Sdk`
   - add `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator` to `PATH`
   - `JAVA_HOME` to the JDK 21 home, for example `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`
6. Check the setup with `npx cap doctor`.

### Verified local baseline

On 2026-09-25 this project was built with JDK 21, Android SDK Platform 35, Build-Tools 34/35, and a Google APIs x86_64 API 35 `Pixel_7_API_35` AVD. The resulting debug APK installed and launched successfully as `nl.macrotrack.app`.

### Daily use
| Command | What it does |
|---|---|
| `npm run android:emu` | Builds the web app, syncs it into `android/` and installs/launches it on a running emulator or connected phone |
| `npm run android:live` | Live reload: the app in the emulator loads from the Vite dev server, so edits appear instantly |
| `npm run android:apk` | Builds `android/app/build/outputs/apk/debug/app-debug.apk`; drag it onto the emulator window or sideload it to a phone |
| `npm run android:open` | Opens the project in Android Studio (logcat, profiler) |

The required height and current-weight onboarding fields also have touch-native minus/plus controls and sliders. They provide a reliable fallback when an AVD does not render its software keyboard.

### Debugging
Open `chrome://inspect/#devices` in Chrome on the PC. The app's WebView appears there, and **inspect** gives
full DevTools: console, network and Application → IndexedDB, where the `macrotrack` database lives.

### Camera and barcodes in the emulator
- AVD settings → Advanced → Back camera = **Webcam0**. The PC webcam is passed through, so you can hold a
  real product barcode up to it.
- **VirtualScene** gives a 3D room instead; a barcode image can be placed on its wall via Extended controls → Camera.
- For AI photo tests, push images with `adb push meal.jpg /sdcard/Pictures/` and pick them from the gallery.

## Level 3 — real phone
Turn on Developer options → USB debugging (or Wireless debugging and `adb pair`). The same
`npm run android:emu` command then offers the phone as a target.
