import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const repoName = process.env.REPO_NAME || 'daylife';
const onGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: onGitHubPages ? `/${repoName}/` : '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5174,
  },
});
