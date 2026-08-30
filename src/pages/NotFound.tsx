import React from 'react';
import { Compass, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ArenaButton, PageShell, Panel, StatusBadge } from '../components/ui/index.js';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageShell contentClassName="grid min-h-[calc(100dvh-var(--navbar-height)-4rem)] place-items-center pb-24">
      <Panel glow className="w-full max-w-xl p-8 text-center">
        <StatusBadge tone="red">
          <Compass className="h-4 w-4" aria-hidden />
          404
        </StatusBadge>
        <h1 className="mt-5 font-display text-4xl font-black text-slate-50">This path is outside the arena</h1>
        <p className="mx-auto mt-3 max-w-md text-slate-300">The page may have moved, or the address may be incorrect. Return home to start a solo training match.</p>
        <ArenaButton type="button" className="mt-7" size="lg" icon={<Home className="h-5 w-5" aria-hidden />} onClick={() => navigate('/')}>
          Return Home
        </ArenaButton>
      </Panel>
    </PageShell>
  );
};

export default NotFound;
