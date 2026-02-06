import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { rnw } from 'vite-plugin-rnw';
import { uniwind } from 'uniwind/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tanstackStart(),
    rnw(),
    uniwind({ cssEntryFile: 'src/global.css', dtsFile: 'src/uniwind.d.ts' }),
    tailwindcss(),
    react({
      babel: {
        plugins: ['babel-plugin-relay'],
      },
    }),
  ],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
});
