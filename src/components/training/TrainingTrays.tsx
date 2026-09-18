import { cardAnchor } from '../../game/presentation.js';
import { BookOpen, Library } from 'lucide-react';
import { HUMAN_ID, validateTrainingAction, type TrainingAction, type TrainingSession } from '../../game/trainingSession.js';
import TrainingCard, { type DisplayCard } from './TrainingCard.js';
import type { Knowledge } from '../../game/types.js';

export type TrayTab = 'hand' | 'market';
export default function TrainingTrays({ session, tab, setTab, onAction, onSelect, onInspect, direct = false }: {
  session: TrainingSession; tab: TrayTab; setTab: (tab: TrayTab) => void;
  onAction: (action: TrainingAction) => void; onSelect: (id: string) => void; onInspect: (card: DisplayCard) => void;
  direct?: boolean;
}) {
  const { game, selectedId, guide } = session;
  const humanTurn = game.currentPlayerIndex === 0 && game.phase === 'action' && !game.pendingEffect;
  const hand = game.players[0].hand;
  const tabs: TrayTab[] = ['hand', 'market'];
  const renderCard = (card: Knowledge, market: boolean) => {
    const action: TrainingAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: HUMAN_ID, knowledgeId: card.id, instanceId: card.instanceId! } };
    const validation = market ? validateTrainingAction(session, action) : { isValid: humanTurn && (guide === 'free' || guide === 'summon') };
    const highlighted = (market && guide === 'draw' && card.id === 'aerial1') || (!market && guide === 'summon' && card.id === 'aerial1');
    const activate = () => { if (market) onAction(action); else if (validation.isValid) onSelect(card.instanceId!); };
    const label = `${market ? 'Draw' : 'Select'} ${card.name}`;
    const guideTarget = highlighted ? market ? 'market' : 'hand' : undefined;
    return <article key={card.instanceId} className={`wd-tray-card ${selectedId === card.instanceId ? 'is-selected' : ''} ${highlighted ? 'is-highlighted' : ''}`}>
      <TrainingCard motionAnchor={cardAnchor('', card)} card={card} selected={selectedId === card.instanceId} playFace={direct} onInspect={onInspect}
        action={direct ? { label, onActivate: activate, valid: validation.isValid, pressed: market ? undefined : selectedId === card.instanceId, guideTarget } : undefined} />
      {!direct && <><span className="wd-tray-name">{card.name}</span><span className="wd-card-stat">{card.element}</span>
      <button className="wd-card-action" type="button" aria-disabled={!validation.isValid} aria-pressed={market ? undefined : selectedId === card.instanceId} aria-label={label} data-guide-target={guideTarget} onClick={activate}>{market ? 'Draw' : selectedId === card.instanceId ? 'Selected' : 'Select'}</button></>}
    </article>;
  };
  return <>
    <div className="wd-tray-tabs" role="tablist" aria-label="Your cards and the market">{tabs.map(value => <button key={value} data-motion-anchor={value === 'hand' ? `hand:${HUMAN_ID}` : 'market'} id={`tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`panel-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const next = event.key === 'Home' ? 'hand' : event.key === 'End' ? 'market' : value === 'hand' ? 'market' : 'hand';
        setTab(next); document.getElementById(`tab-${next}`)?.focus();
      }
    }}>{value === 'hand' ? <BookOpen size={15} aria-hidden="true" /> : <Library size={15} aria-hidden="true" />}{value === 'hand' ? 'Hand' : 'Market'} <span>{value === 'hand' ? hand.length : game.market.length}</span></button>)}</div>
    <section id="panel-hand" className={`wd-tray wd-hand ${tab === 'hand' ? 'is-active' : ''}`} aria-label="Your hand">
      <header data-motion-anchor={`hand:${HUMAN_ID}`}><h2><span className="wd-tray-title"><BookOpen size={17} aria-hidden="true" />Your hand</span><span>{hand.length}/5</span></h2><p>Choose a card, then a creature.</p></header>
      {hand.length ? <div className="wd-tray-cards">{hand.map(card => renderCard(card, false))}</div> : <div className="wd-empty-hand"><span>Knowledge starts here.</span><p>Draw a card from the market, then play it on a creature with enough wisdom.</p><button className="wd-text-button wd-mobile-only" onClick={() => setTab('market')}>Open market →</button></div>}
    </section>
    <section id="panel-market" className={`wd-tray wd-market ${tab === 'market' ? 'is-active' : ''}`} aria-label="Market">
      <header data-motion-anchor="market"><h2><span className="wd-tray-title"><Library size={17} aria-hidden="true" />Market</span><span>{game.market.length}</span></h2><p data-motion-anchor="deck">{game.knowledgeDeck.length} in deck · Drawing uses one action</p></header>
      <div className="wd-tray-cards">{game.market.map(card => renderCard(card, true))}</div>
      {!game.market.length && <p className="wd-empty-hand">The market is empty. Play the cards in your hand.</p>}
    </section>
  </>;
}
