import { defineConfig } from 'vite';

const composeOrigin = process.env.DEVUP_PROXY_ORIGIN ?? 'https://localhost';
const trustLocalCertificate = !process.env.DEVUP_PROXY_ORIGIN;

const proxy = {
  '^/api/(auth|workspaces|tasks|notifications|users|github|direct-conversations)(/|\\?|$)': {
    target: composeOrigin,
    secure: !trustLocalCertificate,
  },
  '/socket.io': { target: composeOrigin, secure: !trustLocalCertificate, ws: true },
};

export default defineConfig({ server: { proxy }, preview: { proxy } });
