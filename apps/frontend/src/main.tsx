import '@fontsource-variable/inter';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountRecovery, FirstRun } from './features/AccountPages';
import { EntryAppearance } from './features/auth/EntryAppearance';
import { JoinWorkspace } from './features/JoinWorkspace';
import { AuthPreview, LandingPage } from './features/landing/LandingPage';
import { WorkspaceApp } from './features/WorkspaceApp';
import { WorkspacePicker } from './features/WorkspacePicker';

// Keep the global cascade after feature styles; its order is owned by app.css.
import './app.css';

document.body.classList.add('devup-design');

const path = window.location.pathname.replace(/\/$/, '');
const authMode = path === '/login' ? 'login' : path === '/register' ? 'register' : null;
const recoveryMode =
  path === '/forgot-password'
    ? 'request'
    : path === '/reset-password'
      ? 'reset'
      : path === '/verify-email'
        ? 'verify'
        : null;

const workspacePath = /^\/workspaces(?:\/([^/]+))?$/.exec(path);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {authMode ||
    recoveryMode ||
    path === '/onboarding' ||
    path === '/onboarding/email' ||
    path === '/join-workspace' ||
    (workspacePath && !workspacePath[1]) ? (
      <EntryAppearance>
        {authMode ? (
          <AuthPreview mode={authMode} />
        ) : recoveryMode ? (
          <AccountRecovery mode={recoveryMode} />
        ) : path === '/onboarding' || path === '/onboarding/email' ? (
          <FirstRun step={path.endsWith('/email') ? 'email' : 'avatar'} />
        ) : path === '/join-workspace' ? (
          <JoinWorkspace />
        ) : (
          <WorkspacePicker />
        )}
      </EntryAppearance>
    ) : workspacePath?.[1] ? (
      <WorkspaceApp workspaceId={workspacePath[1]} />
    ) : (
      <LandingPage />
    )}
  </StrictMode>,
);
