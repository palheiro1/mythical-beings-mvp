import { HUMAN_ID, validateTrainingAction, type TrainingAction, type TrainingSession } from '../../game/trainingSession.js';
import TrainingCard, { type DisplayCard } from './TrainingCard.js';
import type { Knowledge } from '../../game/types.js';

export type TrayTab = 'hand' | 'market';
export default function TrainingTrays({ session, tab, setTab, onAction, onSelect, onInspect }: {
  session: TrainingSession; tab: TrayTab; setTab: (tab: TrayTab) => void;
  onAction: (action: TrainingAction) => void; onSelect: (id: string) => void; onInspect: (card: DisplayCard) => void;
}) {
  const { game, selectedId, guide } = session;
  const humanTurn = game.currentPlayerIndex === 0 && game.phase === 'action' && !game.pendingEffect;
  const hand = game.players[0].hand;
  const tabs: TrayTab[] = ['hand', 'market'];
  const renderCard = (card: Knowledge, market: boolean) => {
    const action: TrainingAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: HUMAN_ID, knowledgeId: card.id, instanceId: card.instanceId! } };
    const validation = market ? validateTrainingAction(session, action) : { isValid: humanTurn && (guide === 'free' || guide === 'summon') };
    const highlighted = (market && guide === 'draw' && card.id === 'aerial1') || (!market && guide === 'summon' && card.id === 'aerial1');
    return <article key={card.instanceId} className={`wd-tray-card ${selectedId === card.instanceId ? 'is-selected' : ''} ${highlighted ? 'is-highlighted' : ''}`}>
      <TrainingCard card={card} selected={selectedId === card.instanceId} onInspect={onInspect} />
      <span className="wd-tray-name">{card.name}</span><span className="wd-card-stat">{card.cost} wisdom · {card.element}</span>
      <button className="wd-card-action" type="button" aria-disabled={!validation.isValid} aria-pressed={market ? undefined : selectedId === card.instanceId} aria-label={`${market ? 'Draw' : 'Select'} ${card.name}`} data-guide-target={highlighted ? market ? 'market' : 'hand' : undefined} onClick={() => { if (market) onAction(action); else if (validation.isValid) onSelect(card.instanceId!); }}>{market ? 'Draw' : selectedId === card.instanceId ? 'Selected' : 'Select'}</button>
    </article>;
  };
  return <>
    <div className="wd-tray-tabs" role="tablist" aria-label="Your cards and the market">{tabs.map(value => <button key={value} id={`tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`panel-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const next = event.key === 'Home' ? 'hand' : event.key === 'End' ? 'market' : value === 'hand' ? 'market' : 'hand';
        setTab(next); document.getElementById(`tab-${next}`)?.focus();
      }
    }}>{value === 'hand' ? 'Hand' : 'Market'} <span>{value === 'hand' ? hand.length : game.market.length}</span></button>)}</div>
    <section id="panel-hand" className={`wd-tray wd-hand ${tab === 'hand' ? 'is-active' : ''}`} aria-label="Your hand">
      <header><h2>Your hand <span>{hand.length}/5</span></h2><p>Choose a card, then a creature.</p></header>
      {hand.length ? <div className="wd-tray-cards">{hand.map(card => renderCard(card, false))}</div> : <div className="wd-empty-hand"><span>Knowledge starts here.</span><p>Draw a card from the market, then play it on a creature with enough wisdom.</p><button className="wd-text-button wd-mobile-only" onClick={() => setTab('market')}>Open market →</button></div>}
    </section>
    <section id="panel-market" className={`wd-tray wd-market ${tab === 'market' ? 'is-active' : ''}`} aria-label="Market">
      <header><h2>Market <span>{game.market.length}</span></h2><p>{game.knowledgeDeck.length} in deck · Drawing uses one action</p></header>
      <div className="wd-tray-cards">{game.market.map(card => renderCard(card, true))}</div>
      {!game.market.length && <p className="wd-empty-hand">The market is empty. Play the cards in your hand.</p>}
    </section>
  </>;
}
