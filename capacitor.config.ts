import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.zenox.app',
  appName: 'ZENOX',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#070103',
    preferredContentMode: 'mobile',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
