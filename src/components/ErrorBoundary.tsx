import { Component, type ReactNode } from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6 text-ink">
        <div className="paper-card max-w-lg p-8 shadow-editorial">
          <h1 className="font-display text-3xl font-medium">Linkscape needs to reopen</h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">Your local data has not been deleted. Reload the extension to try again.</p>
          <Button className="mt-5" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </main>
    );
  }
}
