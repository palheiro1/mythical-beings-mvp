import React, { Component, ErrorInfo, ReactNode } from 'react';
// Router is optional in tests; import lazily to avoid hard coupling
import { useNavigate } from 'react-router-dom';

interface InnerProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallback?: ReactNode;
  navigate?: (path: string) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class NFTSelectionErrorBoundaryInner extends Component<InnerProps, State> {
  constructor(props: InnerProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NFT Selection Error Boundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    if (this.props.navigate) {
      this.props.navigate('/');
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
            <p className="text-white/80 mb-6">
              We apologize for the inconvenience. There was an error loading your card selection.
            </p>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <div className="text-left bg-black/30 text-white p-3 rounded mb-4">
                <div className="font-semibold mb-1">Error Details</div>
                <pre className="whitespace-pre-wrap break-words text-sm">{this.state.error.message}</pre>
              </div>
            )}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full text-white/60 hover:text-white transition-colors duration-200"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const NFTSelectionErrorBoundary: React.FC<{
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallback?: ReactNode;
  navigateFn?: (path: string) => void;
}> = ({ children, onError, fallback, navigateFn }) => {
  // Try to get navigate from router if available; tests may inject navigateFn
  let navigate: ((path: string) => void) | undefined = navigateFn;
  // Allow tests to set a global navigate spy when not using Router
  const globalAny: any = globalThis as any;
  if (!navigate && typeof globalAny.__TEST_NAVIGATE__ === 'function') {
    navigate = globalAny.__TEST_NAVIGATE__;
  }
  try {
    if (!navigate) {
      navigate = useNavigate();
    }
  } catch {
    // Not in a Router context; keep undefined so inner uses window.location fallback
    navigate = navigateFn;
  }
  return (
    <NFTSelectionErrorBoundaryInner navigate={navigate} onError={onError} fallback={fallback}>
      {children}
    </NFTSelectionErrorBoundaryInner>
  );
};

export default NFTSelectionErrorBoundary;