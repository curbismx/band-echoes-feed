import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a82cece6bdd14cf885774e2761f25596',
  appName: 'band-echoes-feed',
  webDir: 'dist',
  // Remove server.url for production builds (TestFlight/App Store)
  // Only use server.url for local development with hot-reload
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0A1014',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
