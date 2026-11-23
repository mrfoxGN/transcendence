document.body.classList.add('devup-design');
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import { LandingPage, AuthPreview } from './features/landing/LandingPage';
import { WorkspacePicker } from './features/WorkspacePicker';
import { WorkspaceApp } from './features/WorkspaceApp';
import { AccountRecovery, FirstRun } from './features/AccountPages';
import { JoinWorkspace } from './features/JoinWorkspace';
import { EntryAppearance } from './features/auth/EntryAppearance';
import './styles.css';
import './tokens.css';
import './input-fields.css';

const path = window.location.pathname.replace(/\/$/, '');
const authMode = path === '/login' ? 'login' : path === '/register' ? 'register' : null;
const recoveryMode = path === '/forgot-password' ? 'request' : path === '/reset-password' ? 'reset' : path === '/verify-email' ? 'verify' : null;

const workspacePath = /^\/workspaces(?:\/([^/]+))?$/.exec(path);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {(authMode || recoveryMode || path === '/onboarding' || path === '/onboarding/email' || path === '/join-workspace' || (workspacePath && !workspacePath[1])) ? <EntryAppearance>{authMode ? <AuthPreview mode={authMode} /> : recoveryMode ? <AccountRecovery mode={recoveryMode} />
      : path === '/onboarding' || path === '/onboarding/email' ? <FirstRun step={path.endsWith('/email') ? 'email' : 'avatar'} />
      : path === '/join-workspace' ? <JoinWorkspace />
      : <WorkspacePicker />}</EntryAppearance> : workspacePath?.[1] ? <WorkspaceApp workspaceId={workspacePath[1]} /> : <LandingPage />}
  </StrictMode>,
);

import './shared/styles/approved-design.css';
import './shared/styles/layout-quality.css';
import './shared/styles/visual-system.css';

import './shared/styles/dark-mode.css';

import './features/auth/entry-design.css';
