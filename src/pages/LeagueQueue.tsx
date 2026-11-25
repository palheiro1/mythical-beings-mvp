import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CompetitiveQueue from '../components/CompetitiveQueue.js';
import { PageShell } from '../components/ui/index.js';
import { competitive, competitiveError, localDate, type WisdomSeason } from '../services/competitiveService.js';

export default function LeagueQueue() {
  const [season, setSeason] = useState<WisdomSeason | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    void competitive.league()
      .then((league) => {
        if (live) setSeason(league.seasons.find((s) => s.status === 'active') ?? null);
      })
      .catch((e) => {
        if (live) setError(competitiveError(e));
      });
    return () => { live = false; };
  }, []);

  return (
    <PageShell contentClassName="max-w-3xl space-y-6">
      <Link to="/competition" className="text-cyan-200">
        ← Modos de jogo
      </Link>
      <h1 className="text-4xl font-bold">Jogar na liga</h1>
      <p>
        Os dois jogadores recebem as mesmas cinco criaturas e escolhem três em segredo. Tens dez minutos para
        todas as tuas decisões.
      </p>
      {season ? (
        <p>
          <strong>{season.name}</strong> · termina {localDate(season.endsAt)}
        </p>
      ) : (
        <p>Ainda não há uma temporada aberta. O financiamento tem de estar confirmado antes da abertura.</p>
      )}
      {error ? <p role="alert" className="text-red-200">{error}</p> : null}
      <CompetitiveQueue group={season ? { seasonId: season.id } : null} />
      <p className="text-sm text-slate-300">
        Só duas partidas contra o mesmo adversário contam em 24 horas.{' '}
        <Link className="text-cyan-200 underline" to="/wagers?mode=casual">
          Criar um encontro casual
        </Link>
        .
      </p>
      <Link className="text-cyan-200 underline" to="/standings">
        Ver classificação e critérios dos prémios
      </Link>
    </PageShell>
  );
}
