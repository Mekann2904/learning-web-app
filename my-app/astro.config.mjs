// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import path from 'path'; 

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  vite: { 
    plugins: [tailwindcss()],
    resolve: {
      alias: { '~/': `${path.resolve('./src')}/` },
     },
  },
});
