import { Capacitor } from '@capacitor/core';

/** True inside the Capacitor Android app (not the browser PWA or the Tauri desktop app). */
export const isNativeApp = () => Capacitor.isNativePlatform();
