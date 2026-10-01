// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

const isVercel = Boolean(process.env.VERCEL);

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: isVercel
    ? vercel()
    : node({
        mode: 'standalone',
      }),
});
