import type { ReactNode } from 'react';
import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import DigitalCardFace from '../DigitalCardFace.js';
import creatureData from '../../assets/creatures.json';
import type { Creature } from '../../game/types.js';
import { BUILD_LABEL } from '../../config/build.js';

const heroCards = ['adaro', 'tarasca', 'tulpar'].map(id => creatureData.find(card => card.id === id) as Creature);

export default function TrainingLanding({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return <div className="wd wd-landing">
    <section className="wd-hero" aria-labelledby="welcome-title">
      <div className="wd-hero-copy">
        <p className="wd-eyebrow">Mythical Beings · Card strategy</p>
        <h1 id="welcome-title">Wisdom Duel<span>Legends in your hands.</span></h1>
        <p className="wd-lead">Command three mythical creatures. Gather knowledge, grow their wisdom, and bring your opponent’s Power to zero.</p>
        <div className="wd-hero-actions">
          <button className="wd-button wd-button-primary" onClick={() => navigate('/bot-selection?mode=guided')}><BookOpen size={18} />Learn to Play<ArrowRight size={18} /></button>
          <button className="wd-button" onClick={() => navigate('/bot-selection?mode=free')}>Practice</button>
        </div>
        <p className="wd-caption">Solo play against the bot. No account or wallet needed.</p>
      </div>
      <div className="wd-hero-gallery" aria-label="Original Mythical Beings card art">
        {heroCards.map((card, i) => <figure key={card.id} className={`wd-hero-card wd-hero-card-${i}`}>
          <DigitalCardFace card={card} variant="detail" sizes="(max-width: 767px) 250px, 400px" />
          <figcaption>{card.name}</figcaption>
        </figure>)}
      </div>
    </section>
    <section className="wd-intro-strip" aria-label="How a duel works">
      <div><span>01</span><p><strong>Choose your creatures</strong>Three legends, each with a different ability.</p></div>
      <div><span>02</span><p><strong>Make every action count</strong>Rotate, draw, or play a knowledge card.</p></div>
      <div><span>03</span><p><strong>Find your combination</strong>Outlast the bot and play again.</p></div>
    </section>
    <section className="wd-about" aria-labelledby="about-mythical">
      <div><p className="wd-eyebrow">An illustrated world</p><h2 id="about-mythical">About Mythical Beings</h2></div>
      <div><p>Myths from around the world, painted by <strong>Ana Santiso</strong>. Wisdom Duel is part of the Mythical Beings universe of illustrated collectibles, lore and games, created by Tarasca.</p>
        <p>The universe also has a physical board game, funded through Kickstarter.</p>
        <div className="wd-text-links"><a href="https://mythicalbeings.io/" target="_blank" rel="noreferrer">Explore the universe <ExternalLink size={14} /></a><a href="https://www.kickstarter.com/projects/tarasca/mythical-beings-the-board-game/" target="_blank" rel="noreferrer">The physical game <ExternalLink size={14} /></a><Link to="/how-to-play">Read the rules <ArrowRight size={14} /></Link></div>
      </div>
    </section>
    <section id="account" className="wd-account" aria-label="Optional Play Hub account">{children}</section>
    <footer className="wd-site-footer"><span>Mythical Beings · Original art by Ana Santiso</span><span>{BUILD_LABEL}</span></footer>
  </div>;
}
