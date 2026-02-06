import path from 'path';
import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [cloudflare()],
  assetsInclude: ['**/*.graphql'],
  build: {
    target: 'esnext'
  },
  resolve: {
    alias: {
      'schema.graphql?raw': path.resolve(__dirname, '../../schema.graphql'),
      'schema.graphql': path.resolve(__dirname, '../../schema.graphql'),
    },
  }
});
