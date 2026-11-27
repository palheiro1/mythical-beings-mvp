import { getCardPresentation } from '../../utils/digitalCards.js';
import { cardAnchor } from '../../game/presentation.js';
import { BookOpen, Library } from 'lucide-react';
import { HUMAN_ID, validateTrainingAction, type TrainingAction, type TrainingSession } from '../../game/trainingSession.js';
import type { GuideGlowTarget } from '../../hooks/useGuideGlow.js';
import TrainingCard, { type CardAction, type DisplayCard } from './TrainingCard.js';
import type { Knowledge } from '../../game/types.js';

export type TrayTab = 'hand' | 'market';
export function DuelTrays({ playerId, hand, market, deckCount, selectedId, tab, setTab, cardAction, onInspect, direct = false, marketList = false, hiddenHands }: {
  playerId: string; hand: Knowledge[]; market: Knowledge[]; deckCount: number; selectedId: string | null;
  tab: TrayTab; setTab: (tab: TrayTab) => void; cardAction?: (card: Knowledge, market: boolean) => CardAction;
  onInspect: (card: DisplayCard) => void; direct?: boolean;
  marketList?: boolean; hiddenHands?: [number, number];
}) {
  const tabs: TrayTab[] = ['hand', 'market'];
  const renderCard = (card: Knowledge, inMarket: boolean) => {
    const action = cardAction?.(card, inMarket);
    const marketRow = inMarket && direct && marketList;
    return <article key={card.instanceId} className={`wd-tray-card ${marketRow ? 'wd-market-row' : ''} ${selectedId === card.instanceId ? 'is-selected' : ''} ${action?.highlighted ? 'is-highlighted' : ''}`}>
      <TrainingCard motionAnchor={cardAnchor('', card)} card={card} selected={selectedId === card.instanceId} playFace={direct} onInspect={onInspect}
        action={direct ? action : undefined} marketRow={marketRow} />
      {!direct && <><span className="wd-tray-name">{card.name}</span><span className="wd-card-stat">{getCardPresentation(card).typeLabel}</span>
      {action && <button className={`wd-card-action ${action.glowing ? 'wd-guide-glow' : ''}`} type="button" aria-disabled={!action.valid} aria-pressed={action.pressed} aria-label={action.label} data-guide-target={action.guideTarget} onClick={action.onActivate}>{inMarket ? 'Draw' : selectedId === card.instanceId ? 'Selected' : 'Select'}</button>}</>}
    </article>;
  };
  return <>
    <div className="wd-tray-tabs" role="tablist" aria-label={hiddenHands ? 'Hands and Market' : 'Your cards and the Market'}>{tabs.map(value => <button key={value} data-motion-anchor={value === 'hand' ? `hand:${playerId}` : 'market'} id={`tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`panel-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const next = event.key === 'Home' ? 'hand' : event.key === 'End' ? 'market' : value === 'hand' ? 'market' : 'hand';
        setTab(next); document.getElementById(`tab-${next}`)?.focus();
      }
    }}>{value === 'hand' ? <BookOpen size={15} aria-hidden="true" /> : <Library size={15} aria-hidden="true" />}{value === 'hand' ? hiddenHands ? 'Hands' : 'Hand' : 'Market'} <span>{value === 'hand' ? hiddenHands ? hiddenHands.join(' / ') : hand.length : market.length}</span></button>)}</div>
    <section id="panel-hand" className={`wd-tray wd-hand ${tab === 'hand' ? 'is-active' : ''}`} aria-label={hiddenHands ? "Player hands" : "Your hand"}>
      {hiddenHands ? <><header><h2>Hands</h2></header><div className="wd-hidden-hands">{hiddenHands.map((count, seat) => <p key={seat}><strong>Player {seat + 1}</strong><span data-motion-anchor={'hand:' + seat}>{count} in hand</span></p>)}</div></> : <>
      <header data-motion-anchor={`hand:${playerId}`}><h2><span className="wd-tray-title"><BookOpen size={17} aria-hidden="true" />Your hand</span><span>{hand.length}/5</span></h2><p>Choose a Knowledge card, then a Creature.</p></header>
      {hand.length ? <div className="wd-tray-cards">{hand.map(card => renderCard(card, false))}</div> : <div className="wd-empty-hand"><span>Your hand is empty.</span><p>Draw a Knowledge card from the Market, then play it on a Creature that meets its Wisdom requirement.</p><button className="wd-text-button wd-mobile-only" onClick={() => setTab('market')}>Open Market →</button></div>}
      </>}
    </section>
    <section id="panel-market" className={`wd-tray wd-market ${tab === 'market' ? 'is-active' : ''}`} aria-label="Market">
      <header data-motion-anchor="market"><h2><span className="wd-tray-title"><Library size={17} aria-hidden="true" />Market</span><span>{market.length}</span></h2><p data-motion-anchor="deck">{deckCount} in deck · Drawing uses one action</p></header>
      <div className="wd-tray-cards">{market.map(card => renderCard(card, true))}</div>
      {!market.length && <p className="wd-empty-hand">The Market is empty. Play the cards in your hand.</p>}
    </section>
  </>;
}

export default function TrainingTrays({ session, tab, setTab, onAction, onSelect, onInspect, direct = false, glow }: {
  session: TrainingSession; tab: TrayTab; setTab: (tab: TrayTab) => void;
  onAction: (action: TrainingAction) => void; onSelect: (id: string) => void; onInspect: (card: DisplayCard) => void;
  direct?: boolean;
  glow?: GuideGlowTarget | null;
}) {
  const { game, selectedId, guide } = session;
  const humanTurn = game.currentPlayerIndex === 0 && game.phase === 'action' && !game.pendingEffect;
  return <DuelTrays playerId={HUMAN_ID} hand={game.players[0].hand} market={game.market} deckCount={game.knowledgeDeck.length}
    selectedId={selectedId} tab={tab} setTab={setTab} onInspect={onInspect} direct={direct} marketList
    cardAction={(card, market) => {
      const action: TrainingAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: HUMAN_ID, knowledgeId: card.id, instanceId: card.instanceId! } };
      const validation = market ? validateTrainingAction(session, action) : { isValid: humanTurn && (guide === 'free' || guide === 'summon') };
      const highlighted = (market && guide === 'draw' && card.id === 'aerial1') || (!market && guide === 'summon' && card.id === 'aerial1');
      const guideTarget = highlighted ? market ? 'market' : 'hand' : undefined;
      return {
        label: `${market ? 'Draw' : 'Select'} ${card.name}`,
        onActivate: () => { if (market) onAction(action); else if (validation.isValid) onSelect(card.instanceId!); },
        valid: validation.isValid,
        highlighted,
        glowing: glow != null && guideTarget === glow,
        pressed: market ? undefined : selectedId === card.instanceId,
        guideTarget,
      };
    }} />
}
