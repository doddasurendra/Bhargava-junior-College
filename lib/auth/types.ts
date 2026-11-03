/** Staff sign-in security state, kept apart from the Staff record (it is read only by lib/auth). */
export interface StaffAuth {
  staffId: string;
  /** sealed (AES-GCM) base32 TOTP secret, set once enrolment is confirmed */
  totpSecretEnc: string | null;
  /** sealed secret shown on the enrolment screen, not yet confirmed with a code */
  totpPendingEnc: string | null;
  totpEnabledAt: string | null;
  /** last accepted TOTP time step — a code can't be replayed */
  totpLastStep: number;
  /** sha256 of each unused recovery code */
  recoveryHashes: string[];
  /** consecutive failed passwords or codes since the last success */
  failedCount: number;
  lockedUntil: string | null;
  /** bumped to sign the user out everywhere (2FA reset, "sign out other devices") */
  sessionVersion: number;
  /** local file store only — production passwords live in Supabase Auth */
  passwordHash?: string | null;
}

export const emptyAuth = (staffId: string): StaffAuth => ({
  staffId,
  totpSecretEnc: null,
  totpPendingEnc: null,
  totpEnabledAt: null,
  totpLastStep: 0,
  recoveryHashes: [],
  failedCount: 0,
  lockedUntil: null,
  sessionVersion: 0,
});

export const LOGIN_METHODS = ['password', 'dev', 'totp', 'recovery', 'enrol', 'logout', 'admin'] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

/** Every sign-in step, success or failure (acceptance criteria: "every login and failed attempt"). */
export interface LoginEvent {
  id: string;
  at: string;
  email: string | null;
  staffId: string | null;
  success: boolean;
  method: LoginMethod;
  /** ok · bad_password · unknown_email · locked · no_access · bad_code · replayed_code · 2fa_reset · unlocked · … */
  reason: string;
  ip: string | null;
  userAgent: string | null;
  /** for admin actions: who did it */
  actorId?: string | null;
}

export type LoginEventInput = Omit<LoginEvent, 'id' | 'at'>;

export interface AuthStore {
  get(staffId: string): Promise<StaffAuth>;
  listAll(): Promise<StaffAuth[]>;
  update(staffId: string, patch: Partial<Omit<StaffAuth, 'staffId'>>): Promise<StaffAuth>;
  /** atomic: count a failure, locking the account once `max` is reached (a lapsed lock starts a fresh count) */
  recordFailure(staffId: string, now: Date, max: number, lockMs: number): Promise<StaffAuth>;
  /** atomic: accept `step` only if it is newer than the last one used */
  useStep(staffId: string, step: number): Promise<boolean>;
  /** atomic: remove the recovery code if present; true when it was */
  consumeRecovery(staffId: string, hash: string): Promise<boolean>;
  staffIdForEmail(email: string): Promise<string | null>;
  logEvent(e: LoginEventInput): Promise<void>;
  listEvents(opts: { limit: number; failedOnly?: boolean; staffId?: string }): Promise<LoginEvent[]>;
}
