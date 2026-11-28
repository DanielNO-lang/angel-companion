/**
 * ANGEL GLOBAL FRIENDLY ERROR & SANITIZED DIAGNOSTIC SERVICE
 *
 * Enforces two strict boundaries across the entire application:
 * 1. Users NEVER see raw HTTP codes, OAuth error codes, Supabase/Gemini errors,
 *    JavaScript exceptions, stack traces, file paths, SQL details, or secrets.
 * 2. Developers receive structured, secret-redacted internal diagnostics so real
 *    failure causes (missing config, OAuth rejection, redirect mismatch, timeout,
 *    rate limit, server failure, render exception, etc.) remain distinguishable.
 */

export type FriendlyErrorContext =
  | 'general'
  | 'network'
  | 'auth'
  | 'google_oauth'
  | 'oauth'
  | 'session'
  | 'media'
  | 'feature'
  | 'ai'
  | 'render';

export type DiagnosticFailureCategory =
  | 'oauth_rejected'
  | 'oauth_cancelled'
  | 'redirect_mismatch'
  | 'missing_config'
  | 'expired_callback'
  | 'invalid_session'
  | 'supabase_unreachable'
  | 'network_timeout'
  | 'api_rate_limit'
  | 'server_failure'
  | 'ai_unavailable'
  | 'media_failure'
  | 'render_exception'
  | 'invalid_credentials'
  | 'email_unconfirmed'
  | 'unknown_failure';

export interface ClassifiedFriendlyError {
  category: DiagnosticFailureCategory;
  context: FriendlyErrorContext;
  userMessage: string;
  title: string;
  retryable: boolean;
}

export interface SanitizedDiagnosticRecord {
  id: string;
  timestamp: string;
  category: DiagnosticFailureCategory;
  context: FriendlyErrorContext;
  summary: string;
  statusCode?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export const FRIENDLY_ERROR_MESSAGES = {
  GENERAL: "Something went wrong. Angel couldn't complete that request. Please try again later.",
  NETWORK: "Angel couldn't connect right now. Check your internet connection and try again.",
  AUTH: "We couldn't complete your sign-in. Please try again.",
  INVALID_CREDENTIALS: "The email or password you entered didn't match our records. Please try again.",
  EMAIL_UNCONFIRMED: "Your email address isn't verified yet. Enter your 6-digit verification code or request a fresh code.",
  GOOGLE_OAUTH: "Google sign-in couldn't be completed. Please try again or choose another sign-in method.",
  GOOGLE_CANCELLED: "Google sign-in was closed before finishing. Try again or choose another sign-in method.",
  OAUTH_GENERIC: "That sign-in option couldn't be completed right now. Please try again or choose another method.",
  SESSION: "Your session couldn't be restored. Please sign in again to continue.",
  MEDIA: "This preview couldn't be loaded. Please try again.",
  FEATURE: "Angel couldn't complete this action right now. Your work has been preserved where possible.",
  RATE_LIMIT: "Too many requests were sent in a short moment. Please wait briefly and try again.",
  SERVICE_UNAVAILABLE: "Sign-in is temporarily unavailable right now. Please try again shortly.",
  LINK_EXPIRED: "That verification code or link is invalid or has expired. Please request a fresh one.",
  AI_HIGH_DEMAND: "Angel's conversation model is temporarily experiencing high demand. Please try again in a moment.",
  AI_TIMEOUT: "Angel took a bit too long to respond. Please try again.",
} as const;

const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|access_token|refresh_token|authorization|apikey|api_key|client_secret|^code$|auth_code|authorization_code|verifier|session|cookie|jwt|credential/i;

const diagnosticBuffer: SanitizedDiagnosticRecord[] = [];

/**
 * Redacts tokens, secrets, passwords, codes, stack traces, and internal paths from strings.
 */
export function scrubSensitiveText(input: unknown): string {
  if (input === null || input === undefined) return '';
  let text = input instanceof Error ? `${input.name}: ${input.message}` : String(input);

  // Strip Google API keys, Bearer tokens & JWT shapes
  text = text.replace(/AIza[0-9A-Za-z\-_]{10,}/g, '[REDACTED_GOOGLE_KEY]');
  text = text.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
  text = text.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]*)?/g, '[REDACTED_JWT]');
  // Strip key=value / query parameters holding sensitive secrets
  text = text.replace(
    /([?&]|\b)(code|access_token|refresh_token|token|apikey|api_key|key|client_secret|password|secret)=([^&\s]+)/gi,
    '$1$2=[REDACTED]'
  );
  // Strip local filesystem stack paths
  text = text.replace(/(?:\/[A-Za-z0-9._-]+){3,}(?::\d+:\d+)?/g, '[PATH_REDACTED]');
  return text.slice(0, 420);
}

/**
 * Recursively redacts sensitive fields from diagnostic metadata objects before developer logging.
 */
export function redactDiagnosticData(
  obj: unknown,
  depth = 0
): Record<string, string | number | boolean | null> {
  if (!obj || typeof obj !== 'object' || depth > 3) return {};
  const result: Record<string, string | number | boolean | null> = {};

  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    if (typeof val === 'string') {
      result[key] = scrubSensitiveText(val);
    } else if (typeof val === 'number' || typeof val === 'boolean' || val === null) {
      result[key] = val;
    } else if (val instanceof Error) {
      result[key] = scrubSensitiveText(val.message);
    } else {
      result[key] = '[OBJECT]';
    }
  }
  return result;
}

/**
 * Records a clean developer-only diagnostic entry while guaranteeing zero credentials/PII leaks.
 */
export function logSanitizedDiagnostic(params: {
  category: DiagnosticFailureCategory;
  context: FriendlyErrorContext;
  rawError?: unknown;
  statusCode?: number;
  metadata?: Record<string, unknown>;
}): SanitizedDiagnosticRecord {
  const record: SanitizedDiagnosticRecord = {
    id: `diag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    category: params.category,
    context: params.context,
    summary: scrubSensitiveText(params.rawError) || params.category,
    ...(typeof params.statusCode === 'number' ? { statusCode: params.statusCode } : {}),
    ...(params.metadata ? { metadata: redactDiagnosticData(params.metadata) } : {}),
  };

  diagnosticBuffer.unshift(record);
  if (diagnosticBuffer.length > 40) diagnosticBuffer.pop();

  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(`[Angel Diagnostic] [${record.category}] (${record.context})`, {
      id: record.id,
      summary: record.summary,
      statusCode: record.statusCode,
      metadata: record.metadata,
    });
  }

  return record;
}

export function getSanitizedDiagnosticsForDev(): SanitizedDiagnosticRecord[] {
  return [...diagnosticBuffer];
}

export function clearSanitizedDiagnostics(): void {
  diagnosticBuffer.length = 0;
}

function extractRawStringAndStatus(rawError: unknown): { raw: string; statusCode?: number } {
  if (!rawError) return { raw: '' };
  if (typeof rawError === 'string') return { raw: rawError };
  if (rawError instanceof Error) {
    const anyErr = rawError as Error & { status?: number; statusCode?: number };
    return {
      raw: `${rawError.name}: ${rawError.message}`,
      statusCode: typeof anyErr.statusCode === 'number' ? anyErr.statusCode : anyErr.status,
    };
  }
  if (typeof rawError === 'object') {
    const rec = rawError as Record<string, unknown>;
    const msg =
      typeof rec.message === 'string'
        ? rec.message
        : typeof rec.error === 'string'
          ? rec.error
          : typeof rec.error_description === 'string'
            ? rec.error_description
            : '';
    const status =
      typeof rec.statusCode === 'number'
        ? rec.statusCode
        : typeof rec.status === 'number'
          ? rec.status
          : undefined;
    return { raw: msg, statusCode: status };
  }
  return { raw: String(rawError) };
}

/**
 * Classifies any raw failure cleanly and maps it to calm, user-friendly Angel copy
 * without collapsing distinct failure modes or exposing technical strings/codes.
 */
export function toFriendlyError(
  rawError: unknown,
  context: FriendlyErrorContext = 'general',
  options?: { statusCode?: number; logDiagnostic?: boolean; metadata?: Record<string, unknown> }
): ClassifiedFriendlyError {
  const extracted = extractRawStringAndStatus(rawError);
  const statusCode = options?.statusCode ?? extracted.statusCode;
  const lower = extracted.raw.toLowerCase();

  let category: DiagnosticFailureCategory = 'unknown_failure';
  let userMessage: string = FRIENDLY_ERROR_MESSAGES.GENERAL;
  let title = "Something didn't go as planned";
  let retryable = true;

  if (context === 'media' || /image|preview|naturalwidth|load preview/i.test(lower)) {
    category = 'media_failure';
    title = 'Preview unavailable';
    userMessage = FRIENDLY_ERROR_MESSAGES.MEDIA;
    retryable = true;
  } else if (context === 'render') {
    category = 'render_exception';
    title = 'Display hiccup';
    userMessage = FRIENDLY_ERROR_MESSAGES.FEATURE;
    retryable = true;
  } else if (statusCode === 429 || /rate limit|too many requests|quota|429/i.test(lower)) {
    category = 'api_rate_limit';
    title = 'Please pause briefly';
    userMessage = FRIENDLY_ERROR_MESSAGES.RATE_LIMIT;
    retryable = true;
  } else if (/redirect_uri|redirect url|origin_mismatch|redirect mismatch/i.test(lower)) {
    category = 'redirect_mismatch';
    title = 'Sign-in unavailable';
    userMessage =
      context === 'google_oauth'
        ? FRIENDLY_ERROR_MESSAGES.GOOGLE_OAUTH
        : FRIENDLY_ERROR_MESSAGES.AUTH;
    retryable = false;
  } else if (
    options?.metadata?.code === 'GEMINI_CONFIG_MISSING' ||
    options?.metadata?.code === 'UNCONFIGURED' ||
    /not configured|missing.*env|vite_supabase|url_missing|key_missing|url_and_key_missing|unconfigured|invalid_url|provider.*(disabled|not enabled|unsupported)|invalid_client|client_id|client_secret|gemini_api_key/i.test(
      lower
    )
  ) {
    category = 'missing_config';
    title = 'Sign-in unavailable right now';
    userMessage =
      context === 'google_oauth'
        ? FRIENDLY_ERROR_MESSAGES.GOOGLE_OAUTH
        : context === 'oauth'
          ? FRIENDLY_ERROR_MESSAGES.OAUTH_GENERIC
          : context === 'ai'
            ? FRIENDLY_ERROR_MESSAGES.FEATURE
            : FRIENDLY_ERROR_MESSAGES.SERVICE_UNAVAILABLE;
    retryable = false;
  } else if (
    /access_denied|user cancelled|user canceled|cancelled|canceled|denied|disallowed_useragent/i.test(lower)
  ) {
    category = /cancel/i.test(lower) ? 'oauth_cancelled' : 'oauth_rejected';
    title = context === 'google_oauth' ? "Google sign-in didn't finish" : "Sign-in didn't finish";
    userMessage =
      context === 'google_oauth'
        ? /cancel/i.test(lower)
          ? FRIENDLY_ERROR_MESSAGES.GOOGLE_CANCELLED
          : FRIENDLY_ERROR_MESSAGES.GOOGLE_OAUTH
        : FRIENDLY_ERROR_MESSAGES.OAUTH_GENERIC;
    retryable = true;
  } else if (
    context === 'session' ||
    statusCode === 401 ||
    /jwt|session.*(expired|not.*restored|couldn't be restored)|not verified|unauthenticated|invalid refresh token/i.test(lower)
  ) {
    category = 'invalid_session';
    title = 'Session needs refresh';
    userMessage = FRIENDLY_ERROR_MESSAGES.SESSION;
    retryable = false;
  } else if (/otp|token.*(expired|invalid)|verification code|expired|invalid.*link|pkce|exchange.*code|authorization code|code_verifier/i.test(lower)) {
    category = 'expired_callback';
    const isCodeError = /otp|token|verification code/i.test(lower);
    title =
      context === 'google_oauth'
        ? "Google sign-in couldn't be completed"
        : isCodeError
          ? 'Code invalid or expired'
          : 'Link no longer valid';
    userMessage =
      context === 'google_oauth'
        ? FRIENDLY_ERROR_MESSAGES.GOOGLE_OAUTH
        : FRIENDLY_ERROR_MESSAGES.LINK_EXPIRED;
    retryable = context === 'google_oauth' || isCodeError;
  } else if (/invalid login credentials|invalid email or password|incorrect password/i.test(lower)) {
    category = 'invalid_credentials';
    title = 'Check your details';
    userMessage = FRIENDLY_ERROR_MESSAGES.INVALID_CREDENTIALS;
    retryable = false;
  } else if (/email not confirmed|confirm your email/i.test(lower)) {
    category = 'email_unconfirmed';
    title = 'Verify your email first';
    userMessage = FRIENDLY_ERROR_MESSAGES.EMAIL_UNCONFIRMED;
    retryable = false;
  } else if (/timed out|timeout|aborterror|abort/i.test(lower)) {
    category = 'network_timeout';
    title = context === 'ai' ? 'Response timed out' : 'Connection timed out';
    userMessage = context === 'ai' ? FRIENDLY_ERROR_MESSAGES.AI_TIMEOUT : FRIENDLY_ERROR_MESSAGES.NETWORK;
    retryable = true;
  } else if (
    context === 'network' ||
    /failed to fetch|networkerror|network request failed|err_internet|offline|unreachable/i.test(lower)
  ) {
    category = /supabase/i.test(lower) ? 'supabase_unreachable' : 'network_timeout';
    title = 'Connection interrupted';
    userMessage = FRIENDLY_ERROR_MESSAGES.NETWORK;
    retryable = true;
  } else if (
    (typeof statusCode === 'number' && statusCode >= 500) ||
    /500|502|503|504|internal server error|bad gateway|service unavailable/i.test(lower)
  ) {
    category = context === 'ai' ? 'ai_unavailable' : 'server_failure';
    title = 'Temporarily unavailable';
    const isModelDemand =
      context === 'ai' &&
      (statusCode === 503 ||
        options?.metadata?.errorCode === 'MODEL_UNAVAILABLE' ||
        /high demand|overloaded|503/i.test(lower));
    userMessage =
      context === 'ai'
        ? isModelDemand
          ? FRIENDLY_ERROR_MESSAGES.AI_HIGH_DEMAND
          : FRIENDLY_ERROR_MESSAGES.FEATURE
        : context === 'google_oauth'
          ? FRIENDLY_ERROR_MESSAGES.GOOGLE_OAUTH
          : FRIENDLY_ERROR_MESSAGES.GENERAL;
    retryable = true;
  } else if (context === 'google_oauth') {
    category = 'oauth_rejected';
    title = "Google sign-in couldn't be completed";
    userMessage = FRIENDLY_ERROR_MESSAGES.GOOGLE_OAUTH;
    retryable = true;
  } else if (context === 'oauth') {
    category = 'oauth_rejected';
    title = "Sign-in couldn't be completed";
    userMessage = FRIENDLY_ERROR_MESSAGES.OAUTH_GENERIC;
    retryable = true;
  } else if (context === 'auth') {
    category = 'unknown_failure';
    title = "Sign-in couldn't be completed";
    userMessage = FRIENDLY_ERROR_MESSAGES.AUTH;
    retryable = true;
  } else if (context === 'feature' || context === 'ai') {
    category = context === 'ai' ? 'ai_unavailable' : 'unknown_failure';
    title = "Action couldn't be completed";
    userMessage = FRIENDLY_ERROR_MESSAGES.FEATURE;
    retryable = true;
  }

  if (options?.logDiagnostic !== false && rawError) {
    logSanitizedDiagnostic({
      category,
      context,
      rawError,
      statusCode,
      metadata: options?.metadata,
    });
  }

  return {
    category,
    context,
    userMessage,
    title,
    retryable,
  };
}

/**
 * Verifies a string contains zero banned technical terms/codes before UI display.
 */
export function containsTechnicalLeak(text: string): boolean {
  if (!text) return false;
  return (
    /\b(400|401|403|404|429|500|502|503|504)\b/.test(text) ||
    /\b(access_denied|invalid_client|otp_expired|redirect_uri_mismatch)\b/i.test(text) ||
    /\b(TypeError|ReferenceError|SyntaxError|RangeError|Error:)\b/.test(text) ||
    /Failed to exchange authorization code/i.test(text) ||
    /VITE_SUPABASE_|GEMINI_API_KEY|SUPABASE_SERVICE_ROLE/i.test(text) ||
    /(\bat\s+[A-Za-z0-9_$.]+\s*\(|src\/components\/|node_modules\/)/i.test(text)
  );
}
