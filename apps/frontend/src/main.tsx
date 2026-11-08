import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import { LandingPage, AuthPreview } from './features/landing/LandingPage';
import './styles.css';
import './tokens.css';

const path = window.location.pathname.replace(/\/$/, '');
const authMode = path === '/login' ? 'login' : path === '/register' ? 'register' : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {authMode ? <AuthPreview mode={authMode} /> : <LandingPage />}
  </StrictMode>,
);
