import { authRoute } from '../auth-routing';

export const sessionKey = 'devup.access-token';
export class SessionExpired extends Error {}

export function signOut(restoreDestination = false) {
  sessionStorage.removeItem(sessionKey);
  window.location.replace(
    restoreDestination
      ? authRoute('/login', location.pathname + location.search + location.hash)
      : '/login',
  );
}

export function switchAccount(destination = '/workspaces') {
  sessionStorage.removeItem(sessionKey);
  location.assign(authRoute('/login', destination));
}
