import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2020', rolldownOptions: { input: { app: 'index.html', deploy: 'deploy.html' } } },
});
