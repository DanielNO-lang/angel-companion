import React from 'react';
import { FRIENDLY_ERROR_MESSAGES, logSanitizedDiagnostic } from '../../services/errorHandlingService';
import type { ThemeMode } from '../../services/authValidation';
import { FriendlyErrorScreen } from './FriendlyErrorScreen';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  theme?: ThemeMode;
  variant?: 'fullscreen' | 'panel';
  resetKey?: string | number;
  goBackLabel?: string;
  onGoBack?: () => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Global & Section React Error Boundary.
 * Catches unexpected runtime render crashes and presents Angel's friendly recovery screen
 * without ever exposing JavaScript exceptions, stack traces, or file paths.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logSanitizedDiagnostic({
      category: 'render_exception',
      context: 'render',
      rawError: error,
      metadata: {
        hasComponentStack: Boolean(info?.componentStack),
      },
    });
  }

  public componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private handleGoBack = () => {
    this.setState({ hasError: false });
    if (this.props.onGoBack) {
      this.props.onGoBack();
      return;
    }
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.history.replaceState({}, '', '/');
        window.location.reload();
      }
    }
  };

  private handleTryAgain = () => {
    this.setState({ hasError: false });
    if (this.props.onReset) {
      this.props.onReset();
    } else if (this.props.variant !== 'panel' && typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <FriendlyErrorScreen
          title="Angel ran into an unexpected display issue"
          message={
            this.props.variant === 'panel'
              ? FRIENDLY_ERROR_MESSAGES.FEATURE
              : FRIENDLY_ERROR_MESSAGES.GENERAL
          }
          theme={this.props.theme || 'dark'}
          variant={this.props.variant || 'fullscreen'}
          goBackLabel={this.props.goBackLabel || 'Go Back'}
          tryAgainLabel="Try Again"
          onGoBack={this.handleGoBack}
          onTryAgain={this.handleTryAgain}
        />
      );
    }

    return this.props.children;
  }
}
