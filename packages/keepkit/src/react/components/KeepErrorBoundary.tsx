import { Component, type ErrorInfo, type ReactNode } from "react";

export type KeepErrorBoundaryProps = {
  children?: ReactNode;
  fallback?: ReactNode | ((error: unknown) => ReactNode);
  onError?: (error: unknown, info: ErrorInfo) => void;
  /** Change this value to retry rendering after an error has been handled. */
  resetKey?: unknown;
};

type KeepErrorBoundaryState = { error: unknown | null };

/** Prevents an unexpected render error from taking down the host application. */
export class KeepErrorBoundary extends Component<KeepErrorBoundaryProps, KeepErrorBoundaryState> {
  state: KeepErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): KeepErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(previousProps: KeepErrorBoundaryProps) {
    if (this.state.error !== null && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error !== null) {
      return typeof this.props.fallback === "function"
        ? this.props.fallback(this.state.error)
        : (this.props.fallback ?? null);
    }
    return this.props.children;
  }
}
