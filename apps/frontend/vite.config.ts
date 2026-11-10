import { defineConfig } from 'vite';

const proxy = {
  '^/api/(auth|workspaces)(/|$)': {
    target: 'http://127.0.0.1:3000',
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig({ server: { proxy }, preview: { proxy } });
