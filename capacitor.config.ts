import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a82cece6bdd14cf885774e2761f25596',
  appName: 'band-echoes-feed',
  webDir: 'dist',
  // Remove server.url for production builds (TestFlight/App Store)
  // Only use server.url for local development with hot-reload
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
