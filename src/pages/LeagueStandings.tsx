import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArenaButton, PageShell, Panel } from '../components/ui/index.js';
import { useAuth } from '../hooks/useAuth.js';
import {
  competitive,
  competitiveError,
  competitiveWalletConfig,
  formatGem,
  localDate,
  type WisdomLeagueResponse,
} from '../services/competitiveService.js';
const reasons: Record<string, string> = {
  games: '10 partidas válidas',
  opponents: '3 adversários diferentes',
  wallet: 'carteira verificada até ao fecho',
  sanction: 'sanção em vigor',
  review: 'revisão pendente',
};
const statuses: Record<string, string> = {
  preparation: 'Em preparação',
  funded: 'Financiada',
  active: 'Em curso',
  review: 'Em revisão',
  finalized: 'Finalizada',
};
export default function LeagueStandings() {
  const { user, polygonWallet, connectPolygonWallet } = useAuth();
  const [data, setData] = useState<WisdomLeagueResponse | null>(null),
    [seasonId, setSeasonId] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    try {
      const next = await competitive.league(seasonId || undefined);
      setData(next);
      if (!seasonId && next.seasons.length) setSeasonId(next.seasons[0].id);
    } catch (e) {
      setError(competitiveError(e));
    }
  }, [seasonId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const season = data?.seasons.find((s) => s.id === seasonId),
    award = season?.allocations?.find((a) => a.playerId === user?.id);
  const decimals = Number(season?.terms.tokenDecimals ?? 18);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(competitiveError(e));
    } finally {
      setBusy(false);
    }
  };
  const claim = async () => {
    if (!season || !award) return;
    const { claimWisdomPrize } = await import('@mythicalb/sdk/wisdom-duel-wallet');
    await claimWisdomPrize(competitive, competitiveWalletConfig(false), season, award.beneficiary, (hash) =>
      setMessage(`Levantamento enviado: ${hash}. A confirmação final é verificada no servidor.`),
    );
  };
  return (
    <PageShell contentClassName="space-y-6">
      <Link to="/competition" className="text-cyan-200">
        ← Modos de jogo
      </Link>
      <h1 className="text-4xl font-bold">Classificação e prémios</h1>
      <label className="block">
        Temporada
        <select
          className="ml-3 rounded border border-white/20 bg-slate-900 p-3"
          value={seasonId}
          onChange={(e) => setSeasonId(e.target.value)}
        >
          {data?.seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {!data?.seasons.length ? (
        <p>A primeira temporada será publicada depois de definidos o orçamento e as datas.</p>
      ) : null}
      {season ? (
        <Panel className="space-y-3 p-6">
          <h2 className="text-2xl font-bold">
            {season.name} · {statuses[season.status]}
          </h2>
          <p>
            {localDate(season.startsAt)} — {localDate(season.endsAt)}
          </p>
          <p>
            Fundo: <strong>{formatGem(season.budgetAtomic, decimals)} GEM</strong> ·{' '}
            {season.fundingStatus === 'finalized'
              ? 'financiamento confirmado'
              : 'financiamento por confirmar'}
            . Prémios: 50% / 30% / 20%.
          </p>
          <p>
            Reclamações até {localDate(season.reviewEndsAt)}.{' '}
            {season.claimDeadline ? `Levantamentos até ${localDate(season.claimDeadline)}.` : ''}
          </p>
          {award ? (
            <div className="space-y-3">
              <p>
                Prémio aprovado: <strong>{formatGem(award.amountAtomic, decimals)} GEM</strong> para{' '}
                <span className="break-all">{award.beneficiary}</span>.
              </p>
              <ArenaButton loading={busy} disabled={award.claimed} onClick={() => void run(claim)}>
                {award.claimed ? 'Prémio levantado' : 'Levantar prémio GEM'}
              </ArenaButton>
            </div>
          ) : null}
          <details>
            <summary className="cursor-pointer text-cyan-200">Regulamento publicado</summary>
            <div className="mt-3 space-y-2 text-sm">
              <p>
                Elo inicial 1500, K = 32. As primeiras dez partidas são provisórias. No máximo duas partidas
                contra o mesmo adversário contam em 24 horas.
              </p>
              <p>
                Para prémios: dez partidas válidas, três adversários diferentes, carteira verificada até ao
                fecho e ausência de sanções ou revisões pendentes. Empates usam o Elo com seis casas decimais;
                os prémios das posições empatadas são repartidos igualmente.
              </p>
              <p>
                As parcelas não atribuídas, os resíduos e os montantes não levantados regressam ao financiador
                após o prazo de 90 dias. Se não houver finalização, a recuperação fica disponível 90 dias após
                o fim da revisão.
              </p>
              <p>
                A fila fecha 25 minutos antes do fim. Datas apresentadas em{' '}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              </p>
            </div>
          </details>
        </Panel>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">Elo, partidas válidas e elegibilidade para prémios</caption>
          <thead>
            <tr className="border-b border-white/20">
              {['Posição', 'Jogador', 'Elo', 'Partidas', 'Adversários', 'Prémios'].map((label) => (
                <th className="p-3" key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.standings.map((row, index) => (
              <tr key={row.playerId} className="border-b border-white/10">
                <td className="p-3">{index + 1}</td>
                <th className="p-3" scope="row">
                  {row.playerId === user?.id
                    ? 'Tu'
                    : (row.playerName ?? `Jogador ${row.playerId.slice(0, 8)}`)}
                </th>
                <td className="p-3">
                  {Math.round(Number(row.rating))}
                  {row.provisional ? ' · provisório' : ''}
                </td>
                <td className="p-3">{row.games}</td>
                <td className="p-3">{row.distinctOpponents}</td>
                <td className="p-3">
                  {row.eligibility.eligible
                    ? 'Elegível'
                    : row.eligibility.reasons.map((r) => reasons[r]).join('; ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        <ArenaButton variant="ghost" loading={busy} onClick={() => void run(refresh)}>
          Atualizar classificação
        </ArenaButton>
        {user && !polygonWallet ? (
          <ArenaButton
            loading={busy}
            onClick={() =>
              void run(async () => {
                await connectPolygonWallet();
                if (season && ['active', 'funded'].includes(season.status))
                  await competitive.enroll(season.id);
              })
            }
          >
            Associar carteira para prémios
          </ArenaButton>
        ) : null}
      </div>
      {user && season?.status === 'review' ? (
        <Panel className="space-y-4 p-6">
          <h2 className="text-2xl font-bold">A tua reclamação</h2>
          <label className="block">
            Explica o resultado ou a situação a rever
            <textarea
              className="mt-2 min-h-28 w-full rounded border border-white/20 bg-slate-950 p-3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={4000}
            />
          </label>
          <ArenaButton
            loading={busy}
            disabled={reason.trim().length < 10 || Date.now() >= Date.parse(season.reviewEndsAt)}
            onClick={() =>
              void run(async () => {
                await competitive.dispute(season.id, reason);
                setReason('');
                setMessage('Reclamação registada para revisão da organização.');
              })
            }
          >
            Enviar reclamação
          </ArenaButton>
          {data?.disputes.map((d) => (
            <p key={d.id}>
              {d.reason} · {d.state === 'open' ? 'Em revisão' : d.resolution}
            </p>
          ))}
        </Panel>
      ) : null}
      {message ? (
        <p role="status" className="break-all text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-red-200">
          {error}
        </p>
      ) : null}
    </PageShell>
  );
}
