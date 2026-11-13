export type AppRoute =
  | 'landing'
  | 'signin'
  | 'signup'
  | 'verify-email'
  | 'forgot-password'
  | 'reset-password'
  | 'auth-callback'
  | 'app';

export type ThemeMode = 'dark' | 'light';

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  checks: {
    minLength: boolean;
    hasLower: boolean;
    hasUpper: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
  isAcceptable: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface ParsedAuthCallback {
  hasCallbackParams: boolean;
  code: string | null;
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  type: 'signup' | 'recovery' | 'magiclink' | 'email_change' | 'invite' | string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  isExpiredOrInvalid: boolean;
  isCancelled: boolean;
  nextPath: string;
}

const ROUTE_TO_PATH: Record<AppRoute, string> = {
  landing: '/',
  signin: '/signin',
  signup: '/signup',
  'verify-email': '/verify-email',
  'forgot-password': '/forgot-password',
  'reset-password': '/reset-password',
  'auth-callback': '/auth/callback',
  app: '/app',
};

const ALLOWED_INTERNAL_PREFIXES = [
  '/',
  '/signin',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/app',
];

export const THEME_STORAGE_KEY = 'angel_theme_mode_v1';
export const REMEMBER_ME_STORAGE_KEY = 'angel_auth_remember_me_v1';

export function validateEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };

  if (!password) {
    return { score: 0, label: 'Too weak', checks, isAcceptable: false };
  }

  let raw = 0;
  if (checks.minLength) raw += 1;
  if (checks.hasLower && checks.hasUpper) raw += 1;
  if (checks.hasNumber) raw += 1;
  if (checks.hasSymbol) raw += 1;
  if (password.length >= 12 && raw >= 3) raw = 4;

  const score = Math.min(4, Math.max(password.length < 8 ? 1 : raw, 1)) as 0 | 1 | 2 | 3 | 4;
  const labels: Record<0 | 1 | 2 | 3 | 4, PasswordStrengthResult['label']> = {
    0: 'Too weak',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };

  return {
    score,
    label: labels[score],
    checks,
    isAcceptable: checks.minLength && (checks.hasLower || checks.hasUpper) && (checks.hasNumber || checks.hasSymbol),
  };
}

export function validateSignInInput(input: { email: string; password: string }): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!validateEmail(input.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!input.password) {
    errors.password = 'Password is required.';
  } else if (input.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateSignUpInput(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.fullName.trim() || input.fullName.trim().length < 2) {
    errors.fullName = 'Please enter your full name (at least 2 characters).';
  }

  if (!input.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!validateEmail(input.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  const strength = evaluatePasswordStrength(input.password);
  if (!input.password) {
    errors.password = 'Password is required.';
  } else if (!strength.checks.minLength) {
    errors.password = 'Password must be at least 8 characters long.';
  } else if (!strength.isAcceptable) {
    errors.password = 'Use a stronger password combining letters with numbers or symbols.';
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (!input.acceptedTerms) {
    errors.acceptedTerms = 'Please acknowledge the Privacy Notice and Terms before creating an account.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validatePasswordResetInput(input: {
  password: string;
  confirmPassword: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  const strength = evaluatePasswordStrength(input.password);

  if (!input.password) {
    errors.password = 'New password is required.';
  } else if (!strength.checks.minLength) {
    errors.password = 'Password must be at least 8 characters long.';
  } else if (!strength.isAcceptable) {
    errors.password = 'Include letters and at least one number or symbol.';
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password.';
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Prevents open redirects by accepting only explicitly allowed relative paths inside Angel.
 */
export function sanitizeRedirectPath(candidate: string | null | undefined, fallback: string = '/app'): string {
  if (!candidate || typeof candidate !== 'string') return fallback;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('/http:') || lower.startsWith('/https:') || lower.includes('javascript:')) {
    return fallback;
  }

  const basePath = trimmed.split('?')[0].split('#')[0];
  const matched = ALLOWED_INTERNAL_PREFIXES.some((prefix) =>
    prefix === '/' ? basePath === '/' : basePath === prefix || basePath.startsWith(`${prefix}/`)
  );

  return matched ? trimmed : fallback;
}

export function parseAppRoute(pathname: string): AppRoute {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';
  switch (clean) {
    case '/':
      return 'landing';
    case '/signin':
      return 'signin';
    case '/signup':
      return 'signup';
    case '/verify-email':
      return 'verify-email';
    case '/forgot-password':
      return 'forgot-password';
    case '/reset-password':
      return 'reset-password';
    case '/auth/callback':
      return 'auth-callback';
    case '/app':
      return 'app';
    default:
      return 'landing';
  }
}

export function getPathForRoute(route: AppRoute): string {
  return ROUTE_TO_PATH[route] || '/';
}

export function parseAuthCallbackParams(search: string = '', hash: string = ''): ParsedAuthCallback {
  const cleanSearch = search.startsWith('?') ? search.slice(1) : search;
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;

  const searchParams = new URLSearchParams(cleanSearch);
  const hashParams = new URLSearchParams(cleanHash);

  const pick = (key: string): string | null => searchParams.get(key) || hashParams.get(key);

  const code = pick('code');
  const tokenHash = pick('token_hash') || pick('token');
  const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
  const type = pick('type');
  const error = pick('error');
  const errorCode = pick('error_code');
  const errorDescription = pick('error_description');
  const nextPath = sanitizeRedirectPath(pick('next'), '/app');

  const combinedErr = `${error || ''} ${errorCode || ''} ${errorDescription || ''}`.toLowerCase();
  const isExpiredOrInvalid =
    Boolean(errorCode === 'otp_expired' || errorCode === 'access_denied' && combinedErr.includes('expired')) ||
    combinedErr.includes('expired') ||
    combinedErr.includes('invalid') ||
    combinedErr.includes('otp');

  const isCancelled =
    error === 'access_denied' &&
    !isExpiredOrInvalid &&
    (combinedErr.includes('cancel') || combinedErr.includes('denied') || combinedErr.includes('user'));

  const hasCallbackParams = Boolean(
    code || tokenHash || accessToken || error || errorCode || errorDescription || type === 'recovery' || type === 'signup' || type === 'email_change'
  );

  return {
    hasCallbackParams,
    code,
    tokenHash,
    accessToken,
    refreshToken,
    type,
    error,
    errorCode,
    errorDescription,
    isExpiredOrInvalid,
    isCancelled,
    nextPath,
  };
}

export function canAccessWorkspace(authStatus: 'loading' | 'unauthenticated' | 'authenticated' | 'unconfigured'): boolean {
  return authStatus === 'authenticated';
}

export function canUnlinkIdentity(identitiesCount: number): { allowed: boolean; reason?: string } {
  if (identitiesCount <= 1) {
    return {
      allowed: false,
      reason: 'You cannot disconnect your sole sign-in method. Connect another login identity or set a password first.',
    };
  }
  return { allowed: true };
}

export function deriveUserInitials(name?: string | null, email?: string | null): string {
  const cleanName = (name || '').trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  }
  const cleanEmail = (email || '').trim();
  if (cleanEmail) {
    return cleanEmail.slice(0, 2).toUpperCase();
  }
  return 'AN';
}

export function getStoredThemeMode(storage?: Pick<Storage, 'getItem'>): ThemeMode {
  try {
    const target = storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
    const val = target?.getItem(THEME_STORAGE_KEY);
    return val === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveStoredThemeMode(mode: ThemeMode, storage?: Pick<Storage, 'setItem'>): void {
  try {
    const target = storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
    target?.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage quota errors
  }
}

export function getRememberMePreference(storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    const target = storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
    const val = target?.getItem(REMEMBER_ME_STORAGE_KEY);
    return val !== 'false';
  } catch {
    return true;
  }
}

export function saveRememberMePreference(remember: boolean, storage?: Pick<Storage, 'setItem'>): void {
  try {
    const target = storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
    target?.setItem(REMEMBER_ME_STORAGE_KEY, remember ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}
