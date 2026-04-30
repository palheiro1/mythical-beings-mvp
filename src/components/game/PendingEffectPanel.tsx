import React from 'react';
import { Wand2 } from 'lucide-react';
import { GameState, PendingEffectChoice, PendingEffectResolution } from '../../game/types.js';
import { ArenaButton, cn, Panel, StatusBadge } from '../ui/index.js';

type PendingEffectPanelProps = {
  gameState: GameState;
  currentPlayerId?: string | null;
  onResolve: (resolution: PendingEffectResolution) => void;
};

const choiceSubtitle = (choice: PendingEffectChoice): string => {
  switch (choice.kind) {
    case 'knowledge':
      return `Knowledge on ${choice.creatureId}`;
    case 'creature':
      return 'Creature';
    case 'hand':
      return 'Hand card';
    case 'market':
      return 'Market card';
  }
};

const choiceKey = (choice: PendingEffectChoice): string => {
  if (choice.kind === 'market' || choice.kind === 'hand') return `${choice.kind}-${choice.instanceId}`;
  if (choice.kind === 'knowledge') return `${choice.kind}-${choice.instanceId}`;
  return `${choice.kind}-${choice.creatureId}`;
};

const PendingEffectPanel: React.FC<PendingEffectPanelProps> = ({ gameState, currentPlayerId, onResolve }) => {
  const pending = gameState.pendingEffect;
  if (!pending) return null;

  const isResolver = pending.playerId === currentPlayerId;

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/45 px-4 backdrop-blur-sm">
      <Panel className="w-full max-w-3xl border-violet-300/30 p-5 shadow-2xl" glow>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <StatusBadge tone={isResolver ? 'violet' : 'muted'}>
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
              Card Effect
            </StatusBadge>
            <h2 className="mt-3 font-display text-2xl text-slate-50">
              {pending.sourceKnowledgeName || 'Resolve effect'}
            </h2>
            <p className="mt-1 text-sm text-slate-300">{pending.prompt}</p>
          </div>
          {!isResolver && (
            <StatusBadge tone="blue">Waiting for opponent</StatusBadge>
          )}
        </div>

        {isResolver ? (
          <>
            <div className="mt-5 grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
              {pending.choices.map(choice => (
                <button
                  key={choiceKey(choice)}
                  type="button"
                  onClick={() => onResolve({ effectId: pending.id, choice })}
                  className={cn(
                    'group rounded-xl border border-white/10 bg-black/30 p-2 text-left transition hover:border-amber-300/60 hover:bg-amber-400/10',
                    'focus:outline-none focus:ring-2 focus:ring-amber-300/50',
                  )}
                >
                  <div className="aspect-[921/1217] overflow-hidden rounded-lg border border-white/10 bg-slate-950/80">
                    {choice.image ? (
                      <img src={choice.image} alt={choice.label} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs uppercase tracking-widest text-slate-500">
                        {choice.kind}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 truncate text-sm font-bold text-slate-100">{choice.label}</p>
                  <p className="truncate text-[11px] uppercase tracking-widest text-slate-500">{choiceSubtitle(choice)}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              {pending.optional && (
                <ArenaButton
                  type="button"
                  variant="ghost"
                  onClick={() => onResolve({ effectId: pending.id, skip: true })}
                >
                  Skip
                </ArenaButton>
              )}
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
            Waiting for the required player to choose a target.
          </div>
        )}
      </Panel>
    </div>
  );
};

export default PendingEffectPanel;
