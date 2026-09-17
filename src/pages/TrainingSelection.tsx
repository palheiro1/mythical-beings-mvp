import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Shuffle } from 'lucide-react';
import creatureData from '../assets/creatures.json';
import type { Creature } from '../game/types.js';
import CardDetailOverlay from '../components/CardDetailOverlay.js';
import TrainingCard, { type DisplayCard } from '../components/training/TrainingCard.js';
import { writeBotCreatureSelection } from '../utils/botSelection.js';
import { GUIDED_TEAM, trainingModeFromSearch } from '../utils/trainingMode.js';

const creatures = creatureData as Creature[];
function dealCreatures(): Creature[] {
  const cards = [...creatures];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.slice(0, 5);
}

function Selection({ guided }: { guided: boolean }) {
  const navigate = useNavigate();
  const [hand, setHand] = useState(() => guided ? GUIDED_TEAM.map(id => creatures.find(card => card.id === id)!) : dealCreatures());
  const [selected, setSelected] = useState<string[]>(() => guided ? [...GUIDED_TEAM] : []);
  const [inspection, setInspection] = useState<DisplayCard | null>(null);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 3 ? [...current, id] : current);
  const start = () => {
    if (selected.length !== 3) return;
    try { writeBotCreatureSelection(selected); } catch { /* Route state also carries the team. */ }
    navigate(`/bot-game?mode=${guided ? 'guided' : 'free'}`, { state: { selectedCreatures: selected } });
  };
  return <div className="wd wd-selection">
    <header className="wd-selection-header">
      <Link to="/" className="wd-back"><ArrowLeft size={16} />Home</Link>
      <p className="wd-eyebrow">{guided ? 'Your first duel · Guided lesson' : 'Solo practice · Choose your team'}</p>
      <h1>{guided ? 'Meet your first three legends.' : 'Three creatures. Your strategy.'}</h1>
      <p>{guided ? 'Start with this team and learn by playing. Take your time — the clock is paused throughout the lesson.' : 'Choose three of these five creatures. Tap the artwork to discover their abilities.'}</p>
      <div className="wd-selection-tools">{guided ? <Link className="wd-text-button" to="/bot-selection?mode=free">Choose my own team <ArrowRight size={16} /></Link> : <><button className="wd-text-button" onClick={() => { setHand(dealCreatures()); setSelected([]); }}><Shuffle size={16} />Shuffle hand</button><Link className="wd-text-button" to="/bot-selection?mode=guided">New here? Try the lesson</Link></>}</div>
    </header>
    <section className={`wd-selection-grid ${guided ? 'is-guided' : ''}`} aria-label="Available creatures">
      {hand.map(card => <article key={card.id} className={`wd-choice ${selected.includes(card.id) ? 'is-selected' : ''}`}>
        <TrainingCard card={card} onInspect={setInspection} />
        <div className="wd-choice-copy"><p className="wd-eyebrow">{card.element}</p><h2>{card.name}</h2><p>{card.passiveAbility}</p></div>
        {guided ? <div className="wd-recommended"><Check size={16} />Recommended</div> : <button className="wd-button" aria-pressed={selected.includes(card.id)} aria-label={`${selected.includes(card.id) ? 'Remove' : 'Choose'} ${card.name}`} disabled={selected.length === 3 && !selected.includes(card.id)} onClick={() => toggle(card.id)}>{selected.includes(card.id) ? <><Check size={16} />Selected</> : 'Choose creature'}</button>}
      </article>)}
    </section>
    <footer className="wd-team-bar">
      <div className="wd-team-slots" aria-label="Your team">{[0, 1, 2].map(index => <span key={index} className={selected[index] ? 'is-filled' : ''}>{selected[index] ? creatures.find(card => card.id === selected[index])?.name : `Creature ${index + 1}`}</span>)}</div>
      <div className="wd-team-start"><span aria-live="polite">{selected.length}/3 selected</span><button className="wd-button wd-button-primary" disabled={selected.length !== 3} onClick={start}>{guided ? 'Start Lesson' : 'Start Practice'}<ArrowRight size={17} /></button></div>
    </footer>
    <CardDetailOverlay card={inspection} open={!!inspection} onClose={() => setInspection(null)} contextLabel="Choose your creature" />
  </div>;
}

export default function TrainingSelection() {
  const { search } = useLocation();
  const mode = trainingModeFromSearch(search);
  return <Selection key={mode} guided={mode === 'guided'} />;
}
