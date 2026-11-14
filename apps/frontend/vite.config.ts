import { defineConfig } from 'vite';

const proxy = {
  '^/api/(auth|workspaces|tasks|notifications|users|github|direct-conversations)(/|\\?|$)': {
    target: 'http://127.0.0.1:3000',
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
  '/socket.io': { target: 'http://127.0.0.1:3000', ws: true },
};

export default defineConfig({ server: { proxy }, preview: { proxy } });
