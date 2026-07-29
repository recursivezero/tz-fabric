import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { logger } from "../utils/logger";

type Props = {
  children: ReactNode;
  resetKey: string;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

/**
 * Keeps a route render/lazy-load failure from blanking the entire application.
 * Changing routes resets the boundary so navigation remains usable.
 */
const ROUTE_ASSET_ERROR_PATTERN =
  /dynamically imported module|loading chunk|module script|failed to fetch/i;

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error ?? ""),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("Route render failed", error, {
      componentStack: info.componentStack ?? undefined,
    });
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: "" });
    }
  }

  private retry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
      return;
    }

    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const routeAssetFailed = ROUTE_ASSET_ERROR_PATTERN.test(
      this.state.errorMessage,
    );

    return (
      <section className="app-error" role="alert" aria-live="assertive">
        <div className="app-error__card">
          <h1>Something went wrong</h1>
          <p>
            {routeAssetFailed
              ? "The page files could not be loaded. Disable browser request blocking or restore the network, then reload the page."
              : "This page could not be displayed. Your uploaded files and chat input have not been submitted again."}
          </p>
          <div className="app-error__actions">
            <button type="button" onClick={this.retry}>
              Reload page
            </button>
            <a href="/">Return home</a>
          </div>
        </div>
      </section>
    );
  }
}
