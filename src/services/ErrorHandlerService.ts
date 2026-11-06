/**
 * ANGEL CENTRALISED ERROR HANDLING SERVICE
 * Provides error classification, error reporting, storage failure handling, and state recovery.
 */

export type AngelErrorCode =
  | 'ERR_STORAGE'
  | 'ERR_VALIDATION'
  | 'ERR_SERVICE'
  | 'ERR_NETWORK'
  | 'ERR_EVENT'
  | 'ERR_NOT_FOUND'
  | 'ERR_PERMISSION';

export class AngelAppError extends Error {
  code: AngelErrorCode;
  timestamp: string;
  details?: Record<string, any>;

  constructor(code: AngelErrorCode, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'AngelAppError';
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.details = details;
  }
}

export interface ErrorLogRecord {
  id: string;
  code: AngelErrorCode;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
  recovered: boolean;
}

export class ErrorHandlerService {
  private static instance: ErrorHandlerService;
  private logs: ErrorLogRecord[] = [];

  private constructor() {}

  static getInstance(): ErrorHandlerService {
    if (!ErrorHandlerService.instance) {
      ErrorHandlerService.instance = new ErrorHandlerService();
    }
    return ErrorHandlerService.instance;
  }

  handleError(error: Error | AngelAppError | unknown, context?: string): ErrorLogRecord {
    let appError: AngelAppError;

    if (error instanceof AngelAppError) {
      appError = error;
    } else if (error instanceof Error) {
      appError = new AngelAppError('ERR_SERVICE', error.message, { context, stack: error.stack });
    } else {
      appError = new AngelAppError('ERR_SERVICE', String(error) || 'Unknown application error', { context });
    }

    const logRecord: ErrorLogRecord = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      code: appError.code,
      message: appError.message,
      timestamp: appError.timestamp,
      details: appError.details,
      recovered: true,
    };

    this.logs.unshift(logRecord);
    if (this.logs.length > 50) this.logs.pop();

    console.warn(`[ErrorHandlerService] [${appError.code}] ${appError.message}`, appError.details || '');
    return logRecord;
  }

  getLogs(): ErrorLogRecord[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const errorHandler = ErrorHandlerService.getInstance();
