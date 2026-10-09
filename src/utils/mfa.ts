import {
  EmailAuthProvider,
  getMultiFactorResolver,
  multiFactor,
  MultiFactorError,
  MultiFactorResolver,
  reauthenticateWithCredential,
  TotpMultiFactorGenerator,
  TotpSecret,
  User,
} from 'firebase/auth';
import { auth } from '../firebaseConfig';

/**
 * Two-step verification with an authenticator app (TOTP: Google Authenticator,
 * Microsoft Authenticator, 1Password, Authy…), using Firebase Auth's built-in
 * multi-factor support. The second factor is enforced by Firebase's servers
 * at sign-in, so it protects the account everywhere, not just this phone.
 *
 * Project prerequisite (one time): Firebase Authentication must be upgraded to
 * Identity Platform and TOTP MFA enabled for the project — see README
 * "Two-step verification". Until then enrollment fails with
 * auth/operation-not-allowed, which friendlyMfaError explains.
 */

export const TOTP_ISSUER = 'SubPulse';

export function isMfaRequiredError(e: any): e is MultiFactorError {
  return e?.code === 'auth/multi-factor-auth-required';
}

export function resolverFor(e: MultiFactorError): MultiFactorResolver {
  return getMultiFactorResolver(auth, e);
}

/** Finishes a sign-in (or re-auth) that Firebase paused for the second factor. */
export async function resolveWithTotp(resolver: MultiFactorResolver, code: string) {
  const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) ?? resolver.hints[0];
  if (!hint) throw new Error('No second factor is enrolled on this account.');
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.replace(/\s/g, ''));
  return resolver.resolveSignIn(assertion);
}

export function enrolledFactors(user: User | null) {
  if (!user) return [];
  try {
    return multiFactor(user).enrolledFactors;
  } catch {
    return [];
  }
}

export function hasTotp(user: User | null): boolean {
  return enrolledFactors(user).some((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
}

/**
 * Re-checks the account password (used by the password lock tier and before
 * security changes). If the account has 2-step on, `askCode` is called to get
 * the authenticator code.
 */
export async function reauthenticate(password: string, askCode: () => Promise<string | null>): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Not signed in');
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } catch (e: any) {
    if (!isMfaRequiredError(e)) throw e;
    const code = await askCode();
    if (!code) throw Object.assign(new Error('Verification cancelled'), { code: 'cancelled' });
    await resolveWithTotp(resolverFor(e), code);
  }
}

export interface PendingEnrollment {
  secret: TotpSecret;
  secretKey: string;
  otpauthUrl: string;
}

/** Step 1: create a TOTP secret to add to the authenticator app. Requires a recent sign-in. */
export async function startTotpEnrollment(): Promise<PendingEnrollment> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  return {
    secret,
    secretKey: secret.secretKey,
    otpauthUrl: secret.generateQrCodeUrl(user.email ?? 'SubPulse user', TOTP_ISSUER),
  };
}

/** Step 2: confirm with the first code from the app; 2-step is on after this. */
export async function finishTotpEnrollment(pending: PendingEnrollment, code: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(pending.secret, code.replace(/\s/g, ''));
  await multiFactor(user).enroll(assertion, 'Authenticator app');
}

export async function disableTotp(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  for (const f of multiFactor(user).enrolledFactors) {
    if (f.factorId === TotpMultiFactorGenerator.FACTOR_ID) await multiFactor(user).unenroll(f);
  }
}

export function friendlyMfaError(e: any): string {
  switch (e?.code) {
    case 'auth/invalid-verification-code':
      return 'That code is not right. Codes change every 30 seconds — try the current one.';
    case 'auth/requires-recent-login':
      return 'For security, enter your password again first.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'Two-step verification is not enabled for this Firebase project yet. See README → "Two-step verification" for the one-time setup.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Wrong password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/unverified-email':
      return 'Verify your email address first (check your inbox), then try again.';
    default:
      return e?.message ?? 'Something went wrong.';
  }
}
