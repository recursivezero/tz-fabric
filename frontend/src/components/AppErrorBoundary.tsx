import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

type Props = {
  children: ReactNode;
  resetKey: string;
};

type State = {
  hasError: boolean;
};

/**
 * Keeps a route render/lazy-load failure from blanking the entire application.
 * Changing routes resets the boundary so navigation remains usable.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Route render failed", error, info.componentStack);
    }
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="app-error" role="alert" aria-live="assertive">
        <div className="app-error__card">
          <h1>Something went wrong</h1>
          <p>
            This page could not be displayed. Your uploaded files and chat input
            have not been submitted again.
          </p>
          <div className="app-error__actions">
            <button type="button" onClick={this.retry}>
              Try again
            </button>
            <a href="/">Return home</a>
          </div>
        </div>
      </section>
    );
  }
}
