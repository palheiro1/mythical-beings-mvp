import { Link } from 'react-router-dom';
import { PageShell, Panel } from '../components/ui/index.js';
import { WEEKLY_CHALLENGE_ENABLED } from '../config/release.js';
const entries = [
  ...(WEEKLY_CHALLENGE_ENABLED ? [['/challenge', 'Weekly Challenge', 'Find a duel and see the standings for each edition.']] : []),
  ['/bot-selection', 'Treinar', 'Aprende as regras e experimenta equipas.'],
  ['/league', 'Jogar na liga', 'Uma oferta igual para ambos. Sem NFTs nem aposta.'],
  ['/wagers', 'Duelos com aposta', 'GEM e uma das cartas utilizadas estão em jogo.'],
  ['/standings', 'Classificação e prémios', 'Consulta a temporada, a elegibilidade e os prémios.'],
];
export default function CompetitiveHub() {
  return (
    <PageShell contentClassName="space-y-6">
      <h1 className="font-display text-4xl">Wisdom Duel</h1>
      <p className="text-slate-300">Escolhe como queres jogar.</p>
      <div className="grid gap-5 sm:grid-cols-2">
        {entries.map(([to, title, description]) => (
          <Link
            key={to}
            to={to}
            style={{ textDecoration: 'none', color: 'inherit' }}
            className="rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <Panel className="h-full space-y-3 p-7">
              <h2 className="text-2xl font-bold text-amber-200">{title}</h2>
              <p>{description}</p>
            </Panel>
          </Link>
        ))}
      </div>
      <p>
        <Link className="text-cyan-200 underline" to="/wagers?mode=casual">
          Encontro casual por convite
        </Link>{' '}
        · Sem Elo ou aposta.
      </p>
    </PageShell>
  );
}
