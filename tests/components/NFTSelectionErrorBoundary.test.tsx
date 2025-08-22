// Tests for Error Boundary component
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NFTSelectionErrorBoundary } from '../../src/components/NFTSelectionErrorBoundary.js';

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Normal content</div>;
};

// Mock console.error to avoid noise in test output
const originalConsoleError = console.error;

describe('NFTSelectionErrorBoundary', () => {
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('should render children when there is no error', () => {
    render(
      <NFTSelectionErrorBoundary>
        <ThrowError shouldThrow={false} />
      </NFTSelectionErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('should render error UI when child component throws', () => {
    render(
      <NFTSelectionErrorBoundary>
        <ThrowError shouldThrow={true} />
      </NFTSelectionErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/We apologize for the inconvenience/i)).toBeInTheDocument();
  });

  it('should display error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <NFTSelectionErrorBoundary>
        <ThrowError shouldThrow={true} />
      </NFTSelectionErrorBoundary>
    );

    expect(screen.getByText(/Error Details/i)).toBeInTheDocument();
    expect(screen.getByText(/Test error message/i)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should hide error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <NFTSelectionErrorBoundary>
        <ThrowError shouldThrow={true} />
      </NFTSelectionErrorBoundary>
    );

    expect(screen.queryByText(/Error Details/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Test error message/i)).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should provide retry functionality', () => {
    const { rerender } = render(
      <NFTSelectionErrorBoundary>
        <ThrowError shouldThrow={true} />
      </NFTSelectionErrorBoundary>
    );

    // Error should be displayed
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();

    const retryButton = screen.getByText(/Try Again/i);
    expect(retryButton).toBeInTheDocument();

    // Click retry button
    retryButton.click();

    // Re-render with no error
    rerender(
      <NFTSelectionErrorBoundary>
        <ThrowError shouldThrow={false} />
      </NFTSelectionErrorBoundary>
    );

    // Should show normal content again
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('should provide navigation back to home', () => {
    const mockNavigate = vi.fn();

    render(
      <NFTSelectionErrorBoundary navigateFn={mockNavigate}>
        <ThrowError shouldThrow={true} />
      </NFTSelectionErrorBoundary>
    );

    const homeButton = screen.getByText(/Go to Home/i);
    expect(homeButton).toBeInTheDocument();

    homeButton.click();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should log error to console', () => {
    render(
      <NFTSelectionErrorBoundary>
        <ThrowError shouldThrow={true} />
      </NFTSelectionErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle multiple error types', () => {
    const NetworkError = () => {
      const error = new Error('Network request failed');
      error.name = 'NetworkError';
      throw error;
    };

    render(
      <NFTSelectionErrorBoundary>
        <NetworkError />
      </NFTSelectionErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it('should maintain error boundary state across re-renders', () => {
    const TestComponent: React.FC<{ count: number }> = ({ count }) => {
      if (count === 1) {
        throw new Error('Count is 1');
      }
      return <div>Count: {count}</div>;
    };

    const { rerender } = render(
      <NFTSelectionErrorBoundary>
        <TestComponent count={0} />
      </NFTSelectionErrorBoundary>
    );

    // Should render normally
    expect(screen.getByText('Count: 0')).toBeInTheDocument();

    // Re-render with error-causing props
    rerender(
      <NFTSelectionErrorBoundary>
        <TestComponent count={1} />
      </NFTSelectionErrorBoundary>
    );

    // Should show error UI
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();

    // Re-render with safe props again
    rerender(
      <NFTSelectionErrorBoundary>
        <TestComponent count={2} />
      </NFTSelectionErrorBoundary>
    );

    // Should still show error UI (error boundary state is maintained)
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it('should reset error state when retry is clicked', async () => {
    const TestComponent: React.FC<{ shouldError: boolean }> = ({ shouldError }) => {
      if (shouldError) {
        throw new Error('Test error');
      }
      return <div>No error</div>;
    };

    const ParentComponent: React.FC = () => {
      const [shouldError, setShouldError] = React.useState(true);

      return (
        <div>
          <button onClick={() => setShouldError(false)}>Fix Error</button>
          <NFTSelectionErrorBoundary>
            <TestComponent shouldError={shouldError} />
          </NFTSelectionErrorBoundary>
        </div>
      );
    };

  render(<ParentComponent />);

    // Should show error initially
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();

  const user = userEvent.setup();
  // Fix the error condition
  await user.click(screen.getByText('Fix Error'));

  // Allow state to settle before retrying
  await Promise.resolve();

  // Click retry
  await user.click(screen.getByText(/Try Again/i));

  // Should show normal content
  expect(await screen.findByText('No error')).toBeInTheDocument();
  });
});
