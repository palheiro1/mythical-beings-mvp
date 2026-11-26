import type { ReactNode, RefObject } from 'react';
import { BookOpen, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ActionLights from './ActionLights.js';
import '../../trainingLandscape.css';
import '../../trainingMotion.css';
import '../../trainingArena.css';
import '../../trainingAudio.css';
import '../../trainingKai.css';

export function DuelArena({ root, layer, unlock, direct, guided, activeSide, title, announcement, header, children }: {
  root: RefObject<HTMLDivElement | null>; layer: RefObject<HTMLDivElement | null>; unlock: () => void;
  direct: boolean; guided?: boolean; activeSide?: 'player' | 'opponent'; title: string;
  announcement: string; header: ReactNode; children: ReactNode;
}) {
  return <div ref={root} onPointerDownCapture={unlock} onKeyDownCapture={unlock}
    className={['wd wd-match wd-confluence wd-kai', guided && 'has-guide', direct && 'wd-direct'].filter(Boolean).join(' ')} data-active-side={activeSide}>
    <h1 className="sr-only">{title}</h1>
    <div ref={layer} className="wd-motion-layer" aria-hidden="true" inert />
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    {header}{children}
  </div>;
}

export function ArenaHeader({ clock, warning, onRules, children }: {
  clock?: string; warning?: 'red' | 'amber'; onRules: () => void; children: ReactNode;
}) {
  return <header className="wd-match-header" data-clock-warning={warning}>
    {warning && <span key={warning} className="wd-clock-flare" aria-hidden="true" />}
    <Link to="/" className="wd-brand" aria-label="Wisdom Duel home"><img src="/logos/logo-header-dark.webp" alt="" width="44" height="34" /><span>Wisdom Duel</span></Link>
    <div className="wd-match-controls">
      {clock !== undefined && <div className={'wd-match-clock' + (warning === 'red' ? ' wd-clock-low' : '')} role="timer" aria-label="Turn clock"><Clock3 size={15} aria-hidden="true" />{clock}</div>}
      <button type="button" className="wd-button wd-match-rules" aria-label="Rules" onClick={onRules}><BookOpen size={17} aria-hidden="true" /><span>Rules</span></button>
      {children}
    </div>
  </header>;
}

export function PowerMedallion({ power, side, owner, label, handSize, actions }: {
  power: number; side: 'player' | 'opponent'; owner: string; label: string; handSize?: number; actions?: { remaining: number; total: number };
}) {
  const value = Math.max(0, power);
  return <div className={'wd-power-medallion wd-power-' + side} data-motion-anchor={handSize === undefined ? undefined : 'hand:' + owner}
    title={handSize === undefined ? label : label + ' · ' + handSize + ' in hand'}>
    <strong className="wd-power-value" data-motion-anchor={'power:' + owner} aria-label={label + ' Power: ' + value}>{value}</strong>
    {actions && <ActionLights owner={owner} {...actions} />}
  </div>;
}

export function TurnCallout({ turn, label, complete }: { turn: number; label: string; complete?: boolean }) {
  return <div className="wd-turn"><span>Turn {turn}</span><strong key={turn + label} className={complete ? undefined : 'wd-turn-callout'}>{label}</strong></div>;
}
