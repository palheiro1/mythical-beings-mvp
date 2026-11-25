import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../utils/telemetry.js';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  recoveryKey: number;
}

export class AppErrorBoundary extends Component<Props, State> {
  private heading: HTMLHeadingElement | null = null;

  private setHeading = (node: HTMLHeadingElement | null) => {
    this.heading = node;
    node?.focus();
  };

  state: State = { error: null, recoveryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, {
      source: 'react_error_boundary',
      componentStack: info.componentStack ?? '',
    });
  }

  componentDidUpdate(_previousProps: Props, previousState: State): void {
    if (!previousState.error && this.state.error) {
      this.heading?.focus();
    }
  }

  private retry = () => {
    this.setState(({ recoveryKey }) => ({ error: null, recoveryKey: recoveryKey + 1 }));
  };

  render() {
    if (!this.state.error) {
      return <div key={this.state.recoveryKey}>{this.props.children}</div>;
    }

    return (
      <main className="arena-page grid min-h-screen place-items-center p-6 text-white" role="alert" aria-live="assertive">
        <section className="arena-panel w-full max-w-xl p-8 text-center">
          <p className="arena-kicker">Recovery mode</p>
          <h1
            ref={this.setHeading}
            tabIndex={-1}
            className="mt-3 text-3xl font-black text-amber-100 outline-none"
          >
            The arena hit an unexpected problem
          </h1>
          <p className="mt-4 text-slate-300">
            Your browser did not send game state, wallet details, or personal data with this error.
            You can retry the screen, reload the application, or return to public training.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-5 max-h-40 overflow-auto rounded-xl bg-slate-950/70 p-3 text-left text-xs text-rose-200">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" className="arena-button arena-button--primary" onClick={this.retry}>
              Retry screen
            </button>
            <button type="button" className="arena-button arena-button--secondary" onClick={() => window.location.reload()}>
              Reload app
            </button>
            <a className="arena-button arena-button--ghost" href="/">
              Return home
            </a>
          </div>
        </section>
      </main>
    );
  }
}
