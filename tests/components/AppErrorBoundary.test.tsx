import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const telemetryMocks = vi.hoisted(() => ({ reportError: vi.fn() }));
vi.mock('../../src/utils/telemetry.js', () => telemetryMocks);

import { AppErrorBoundary } from '../../src/components/AppErrorBoundary.js';

const originalConsoleError = console.error;

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    console.error = vi.fn();
    telemetryMocks.reportError.mockClear();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders the application normally', () => {
    render(<AppErrorBoundary><p>Arena ready</p></AppErrorBoundary>);
    expect(screen.getByText('Arena ready')).toBeInTheDocument();
  });

  it('shows an accessible recovery surface and reports a sanitized error path', () => {
    const Broken = () => { throw new Error('render failed'); };
    render(<AppErrorBoundary><Broken /></AppErrorBoundary>);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /unexpected problem/i })).toHaveFocus();
    expect(screen.getByRole('button', { name: /retry screen/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return home/i })).toHaveAttribute('href', '/');
    expect(telemetryMocks.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: 'react_error_boundary' }),
    );
  });

  it('can retry a transient render failure without reloading the page', async () => {
    const Transient = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('once');
      }
      return <p>Recovered arena</p>;
    };

    const Parent = () => {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShouldThrow(false)}>Repair dependency</button>
          <AppErrorBoundary><Transient shouldThrow={shouldThrow} /></AppErrorBoundary>
        </>
      );
    };

    render(<Parent />);
    await userEvent.click(screen.getByRole('button', { name: /repair dependency/i }));
    await userEvent.click(screen.getByRole('button', { name: /retry screen/i }));
    expect(screen.getByText('Recovered arena')).toBeInTheDocument();
  });
});
