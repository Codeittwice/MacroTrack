# Testing MacroTrack on Windows

MacroTrack's Windows app is a Tauri wrapper around the same local-first Vite build used by the browser and Android app. It stores its data in the desktop WebView's local IndexedDB, separately from a browser profile.

## Daily development

| Command | What it does |
| --- | --- |
| `npm run desktop:dev` | Starts Vite and opens the native MacroTrack window with development tools available. |
| `npm run desktop:build` | Builds the production web assets, Rust host, and NSIS installer. |
| `npm test` | Runs the browser-facing regression suite. |

The Tauri development host uses port `5173`. Stop an existing Vite server on that port before running `npm run desktop:dev`, or use that command as the only development server.

## Release artifact

After a successful `npm run desktop:build`, the Windows installer is written to:

```text
src-tauri/target/release/bundle/nsis/MacroTrack_0.1.0_x64-setup.exe
```

The unpackaged release executable is at:

```text
src-tauri/target/release/macrotrack.exe
```

Both `target/` paths are generated output and are intentionally ignored by Git.

## Native smoke check

1. Run the installer or release executable.
2. Complete onboarding using a temporary non-personal profile.
3. Add a quick food entry or water amount, close the desktop app, then reopen it.
4. Confirm the entry remains. This verifies the Windows WebView's offline IndexedDB persistence.

The first native launch may require Windows WebView2 Runtime, which is preinstalled on current Windows 10 and 11 releases. The Windows build toolchain requires Rust with the MSVC target and Microsoft C++ Build Tools.
