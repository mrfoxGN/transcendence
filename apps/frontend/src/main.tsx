import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import { LandingPage, AuthPreview } from './features/landing/LandingPage';
import { WorkspacePicker } from './features/WorkspacePicker';
import { WorkspaceApp } from './features/WorkspaceApp';
import './styles.css';
import './tokens.css';

const path = window.location.pathname.replace(/\/$/, '');
const authMode = path === '/login' ? 'login' : path === '/register' ? 'register' : null;

const workspacePath = /^\/workspaces(?:\/([^/]+))?$/.exec(path);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {authMode ? <AuthPreview mode={authMode} /> : workspacePath ? workspacePath[1] ? <WorkspaceApp workspaceId={workspacePath[1]} /> : <WorkspacePicker /> : <LandingPage />}
  </StrictMode>,
);
