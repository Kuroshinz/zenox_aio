import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const rootDir = import.meta.dirname;
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
        '@designcodeio/threeui/style.css': path.resolve(rootDir, 'src/shaders/threeui.css'),
        '@designcodeio/threeui': path.resolve(rootDir, 'src/shaders/index.ts'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'firebase-firestore',
                test: /node_modules[\\/]@firebase[\\/]firestore[\\/]/,
              },
              {
                name: 'firebase',
                test: /node_modules[\\/](?:firebase|@firebase)[\\/]/,
              },
              {
                name: 'react-vendor',
                test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              },
              {
                name: 'fitness-core',
                test: /src[\\/]utils[\\/]fitnessMetrics\.ts/,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
