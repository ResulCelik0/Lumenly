import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches any rendering error in the tree and shows a recoverable fallback
 * instead of a blank "white screen of death". The reset button clears the local
 * wallet session flag and reloads, so a bad cached state can't trap the user.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface it for debugging; in production this just aids local diagnosis.
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  handleReset = () => {
    try {
      // Drop any persisted wallet session so a corrupt state can't trap the user.
      localStorage.removeItem("lumenly:session");
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="app">
        <main className="main">
          <div className="hero">
            <h1>Something went wrong</h1>
            <p className="muted">
              The app hit an unexpected error. Your funds are safe — nothing is
              stored here and Freighter holds your keys.
            </p>
          </div>
          <section className="card connect-card">
            <div className="feedback feedback--error" role="alert">
              <div className="feedback__icon">✕</div>
              <div className="feedback__body">
                <strong>Unexpected error</strong>
                <p>{this.state.error.message}</p>
              </div>
            </div>
            <button className="btn btn--primary btn--block" onClick={this.handleReset}>
              Reset &amp; reload
            </button>
          </section>
        </main>
      </div>
    );
  }
}
