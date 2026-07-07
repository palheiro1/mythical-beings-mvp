import React, { ReactNode } from 'react';
import { cn } from '../ui/index.js';

interface GameShellProps {
  topBar: ReactNode;
  children: ReactNode;
  actionBar: ReactNode;
  overlays?: ReactNode;
  className?: string;
}

const GameShell: React.FC<GameShellProps> = ({ topBar, children, actionBar, overlays, className }) => {
  return (
    <div className={cn('relative flex min-h-[calc(100dvh-var(--navbar-height))] flex-col overflow-x-hidden bg-[#03050b] text-white xl:h-[calc(100dvh-var(--navbar-height))] xl:overflow-hidden', className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.14),transparent_34%),radial-gradient(circle_at_84%_16%,rgba(34,211,238,0.10),transparent_28%)]" />
      {overlays}
      <div className="relative z-20 shrink-0">{topBar}</div>
      <div className="relative z-10 min-h-0 flex-1 p-2">
        {children}
      </div>
      <div className="relative z-20 shrink-0">{actionBar}</div>
    </div>
  );
};

export default GameShell;
