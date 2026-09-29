import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nl.macrotrack.app',
  appName: 'MacroTrack',
  webDir: 'dist',
  // Android 15 draws apps edge-to-edge; keep the WebView clear of the status and navigation bars.
  android: { backgroundColor: '#0F1115', adjustMarginsForEdgeToEdge: 'force' },
};

export default config;
