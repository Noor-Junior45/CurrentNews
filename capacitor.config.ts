import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'blog.currentnews.app',
  appName: 'Current News',
  webDir: 'dist',
  server: {
    url: 'https://www.currentnews.blog',
    cleartext: false
  }
};

export default config;
