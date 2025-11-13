import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a82cece6bdd14cf885774e2761f25596',
  appName: 'band-echoes-feed',
  webDir: 'dist',
  server: {
    url: 'https://a82cece6-bdd1-4cf8-8577-4e2761f25596.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
