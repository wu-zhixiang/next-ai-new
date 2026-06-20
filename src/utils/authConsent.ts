export interface AuthConsentState {
  userId?: string;
  authConsentGranted?: boolean;
  profileAuthed?: boolean;
}

export function hasAuthConsent(info?: AuthConsentState | null): boolean {
  return Boolean(
    info?.userId
    && info.authConsentGranted === true,
  );
}
