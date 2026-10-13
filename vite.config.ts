import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works under https://<user>.github.io/<repo>/
  base: './',
  server: { port: 5180, strictPort: true },
  build: { target: 'es2022' },
});
