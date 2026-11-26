import type { AppRoute } from './authValidation';

/**
 * ANGEL SAFE RECOVERY NAVIGATION SERVICE
 *
 * Manages reliable "Go Back" navigation and OAuth return origin tracking so that:
 * - Error recovery never navigates back into /auth/callback, ?code=, ?error=, or hash tokens
 * - Users never enter redirect loops
 * - Google OAuth failures return directly to the page where sign-in started (/signin or /signup)
 * - Non-sensitive form/workflow context is preserved without ever storing passwords or tokens
 */

const AUTH_ORIGIN_KEY = 'angel_auth_flow_origin_v1';
const SAFE_DRAFT_KEY = 'angel_safe_workflow_draft_v1';

const SAFE_ROUTE_PATHS: Record<AppRoute, string> = {
  landing: '/',
  signin: '/signin',
  signup: '/signup',
  'verify-email': '/verify-email',
  'forgot-password': '/forgot-password',
  'reset-password': '/reset-password',
  'auth-callback': '/signin',
  'auth-preview-callback': '/signin',
  'preview-auth': '/preview-auth',
  'debug-preview-auth': '/debug/preview-auth',
  app: '/app',
};

export interface SafeWorkflowDraft {
  authEmail?: string;
  activeTab?: string;
  updatedAt: number;
}

const routeStack: AppRoute[] = [];
let memoryAuthOrigin: 'signin' | 'signup' = 'signin';
let memoryDraft: SafeWorkflowDraft | null = null;

export function isSensitiveOrCallbackUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return true;
  const lower = rawUrl.toLowerCase();
  return (
    lower.includes('/auth/callback') ||
    lower.includes('/auth/preview-callback') ||
    lower.includes('?code=') ||
    lower.includes('&code=') ||
    lower.includes('?error=') ||
    lower.includes('&error=') ||
    lower.includes('access_token=') ||
    lower.includes('refresh_token=') ||
    lower.includes('token_hash=')
  );
}

export function isSafeReturnRoute(route: AppRoute): boolean {
  return route !== 'auth-callback' && route !== 'auth-preview-callback';
}

export function pushSafeRoute(route: AppRoute): void {
  if (!isSafeReturnRoute(route)) return;
  if (routeStack[routeStack.length - 1] !== route) {
    routeStack.push(route);
    if (routeStack.length > 15) {
      routeStack.shift();
    }
  }
}

export function peekPreviousSafeRoute(currentRoute: AppRoute, fallback: AppRoute = 'landing'): AppRoute {
  for (let i = routeStack.length - 1; i >= 0; i -= 1) {
    const candidate = routeStack[i];
    if (candidate !== currentRoute && isSafeReturnRoute(candidate)) {
      return candidate;
    }
  }
  return fallback;
}

export function popSafeReturnRoute(currentRoute: AppRoute, fallback: AppRoute = 'landing'): AppRoute {
  while (routeStack.length > 0) {
    const candidate = routeStack.pop()!;
    if (candidate !== currentRoute && isSafeReturnRoute(candidate)) {
      return candidate;
    }
  }
  return fallback;
}

export function getSafePathForRoute(route: AppRoute): string {
  return SAFE_ROUTE_PATHS[route] || '/';
}

export function setAuthFlowOrigin(origin: 'signin' | 'signup'): void {
  memoryAuthOrigin = origin;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTH_ORIGIN_KEY, origin);
  } catch {
    // Fallback to in-memory origin
  }
}

export function getAuthFlowOrigin(): 'signin' | 'signup' {
  if (typeof window === 'undefined') return memoryAuthOrigin;
  try {
    const stored = window.sessionStorage.getItem(AUTH_ORIGIN_KEY);
    if (stored === 'signup' || stored === 'signin') {
      return stored;
    }
  } catch {
    // Ignore storage read restrictions
  }
  return memoryAuthOrigin;
}

export function saveSafeWorkflowDraft(patch: Partial<Omit<SafeWorkflowDraft, 'updatedAt'>>): void {
  const prev = restoreSafeWorkflowDraft() || { updatedAt: Date.now() };
  const next: SafeWorkflowDraft = {
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  };
  memoryDraft = next;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SAFE_DRAFT_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

export function restoreSafeWorkflowDraft(): SafeWorkflowDraft | null {
  if (typeof window === 'undefined') return memoryDraft;
  try {
    const raw = window.sessionStorage.getItem(SAFE_DRAFT_KEY);
    if (!raw) return memoryDraft;
    const parsed = JSON.parse(raw) as SafeWorkflowDraft;
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // Ignore parse failures
  }
  return memoryDraft;
}

/**
 * Replaces the active browser URL cleanly without sensitive query/hash callback tokens.
 */
export function scrubCallbackUrlFromHistory(targetRoute: AppRoute): void {
  if (typeof window === 'undefined') return;
  try {
    const safePath = getSafePathForRoute(targetRoute);
    if (
      window.location.pathname !== safePath ||
      window.location.search ||
      window.location.hash
    ) {
      window.history.replaceState({}, '', safePath);
    }
  } catch {
    // Ignore history restrictions
  }
}

export function resetNavigationStateOnSignOut(): void {
  routeStack.length = 0;
  memoryAuthOrigin = 'signin';
  memoryDraft = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(AUTH_ORIGIN_KEY);
    window.sessionStorage.removeItem(SAFE_DRAFT_KEY);
  } catch {
    // Ignore storage access restrictions
  }
}

export function resetRecoveryNavigationForTests(): void {
  routeStack.length = 0;
  memoryAuthOrigin = 'signin';
  memoryDraft = null;
}
