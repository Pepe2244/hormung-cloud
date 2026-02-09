import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'server',
  adapter: vercel(),
  vite: {
    server: {
      allowedHosts: [
        '701d6667-32a2-4850-b35f-6fa9f377465e-00-1zng2lfsnunsi.janeway.replit.dev'
      ]
    }
  }
});
