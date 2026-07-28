import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves a project site from `/<repo>/`, so built asset URLs
  // need that prefix. Set this to '/' if the site ever moves to a custom domain.
  base: '/weather-demo/',
});
