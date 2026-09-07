// There's no login in this app (no identity provider wired up) - "Mine oppgaver"
// still needs to know which GitHub login is "you", so it's a one-time local pick
// remembered per browser instead of a real session.
const KEY = 'prosjektsporing.currentUser';

export function getCurrentUser(): string | null {
  return localStorage.getItem(KEY);
}

export function setCurrentUser(login: string): void {
  localStorage.setItem(KEY, login);
}

export function clearCurrentUser(): void {
  localStorage.removeItem(KEY);
}
