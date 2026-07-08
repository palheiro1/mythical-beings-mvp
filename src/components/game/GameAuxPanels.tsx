import React, { useEffect, useState } from 'react';
import { Knowledge } from '../../game/types.js';
import { useCardRegistry } from '../../context/CardRegistry.js';
import MarketColumn from './MarketColumn.js';
import Logs from './Logs.js';

interface GameAuxPanelsProps {
  marketCards: Knowledge[];
  deckCount: number;
  isMyTurn: boolean;
  phase: 'knowledge' | 'action' | 'end';
  logs: string[];
  onDrawKnowledge: (knowledgeId: string) => void;
}

const DESKTOP_QUERY = '(min-width: 1280px)';

const getIsDesktop = () => (
  typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches
);

const GameAuxPanels: React.FC<GameAuxPanelsProps> = ({
  marketCards,
  deckCount,
  isMyTurn,
  phase,
  logs,
  onDrawKnowledge,
}) => {
  const registry = useCardRegistry();
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia(DESKTOP_QUERY);
    const handleChange = () => setIsDesktop(media.matches);

    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const renderMarketPanel = () => (
    <div className="h-full min-h-0" ref={(el) => { if (el) registry.register('market:anchor', el); }}>
      <MarketColumn
        marketCards={marketCards}
        deckCount={deckCount}
        isMyTurn={isMyTurn}
        phase={phase}
        onDrawKnowledge={onDrawKnowledge}
      />
    </div>
  );

  const renderLogsPanel = () => (
    <div className="h-full min-h-0" ref={(el) => { if (el) registry.register('discard:anchor', el); }}>
      <Logs logs={logs} />
    </div>
  );

  if (isDesktop) {
    return (
      <aside className="order-3 flex h-full min-h-0 flex-col gap-2">
        <div className="min-h-0 flex-[1.35]">
          {renderMarketPanel()}
        </div>
        <div className="min-h-0 flex-[0.82]">
          {renderLogsPanel()}
        </div>
      </aside>
    );
  }

  return (
    <details className="order-3 min-h-0">
      <summary className="mb-2 cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold uppercase tracking-normal text-slate-200">
        Market and game log
      </summary>
      <div className="grid min-h-0 gap-2 md:grid-cols-2">
        {renderMarketPanel()}
        {renderLogsPanel()}
      </div>
    </details>
  );
};

export default GameAuxPanels;
