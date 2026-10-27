import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://randomjin.top',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
});
