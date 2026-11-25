import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArenaButton, PageShell, Panel } from '../components/ui/index.js';
import {
  competitive,
  competitiveError,
  formatGem,
  localDate,
  parseGem,
} from '../services/competitiveService.js';

type Season = {
  id: string;
  name: string;
  status: string;
  budget_atomic: string;
  starts_at: string;
  ends_at: string;
  review_ends_at: string;
  funding_status: string;
  distribution_frozen: boolean;
  distribution: null | Array<{ playerId: string; beneficiary: string; amountAtomic: string }>;
  terms: { tokenDecimals: number };
};
type Dashboard = {
  controls: {
    league_entries: boolean;
    wager_entries: boolean;
    casual_entries: boolean;
    commands_enabled: boolean;
    recovery_enabled: boolean;
  };
  seasons: Season[];
  disputes: Array<{ id: string; season_id: string; reason: string }>;
  matches: Array<{ id: string; mode: string; status: string; settlementStatus: string }>;
  jobs: Array<{ id: number; kind: string; state: string; attempts: number; last_error: string | null }>;
  audit: Array<{ id: number; action: string; reason: string; created_at: string }>;
};
type Metrics = {
  queueCount: number;
  oldestQueueSeconds: number;
  confirmationMisses24h: number;
  selectionMisses24h: number;
  medianMatchSeconds: number | null;
  resignations: number;
  timeouts: number;
  firstPlayerWinRate: number | null;
  oldestPendingTransactionSeconds: number;
  heartbeatAgeSeconds: number;
  versionConflicts24h: number;
  creatures: Array<{ creature: string; games: number; score: number }>;
  trios: Array<{ trio: string[]; games: number; score: number }>;
  reviewSignals: unknown[];
};
type Metadata = { chainId: number; tokenDecimals: number; gemAddress: string };

export default function LeagueAdmin() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [data, setData] = useState<Dashboard | null>(null),
    [meta, setMeta] = useState<Metadata | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(''),
    [start, setStart] = useState(''),
    [budget, setBudget] = useState(''),
    [pool, setPool] = useState(''),
    [reason, setReason] = useState(''),
    [selected, setSelected] = useState(''),
    [matchId, setMatchId] = useState(''),
    [playerId, setPlayerId] = useState(''),
    [tx, setTx] = useState(''),
    [kind, setKind] = useState<'fund' | 'finalize' | 'sweep'>('fund'),
    [prepared, setPrepared] = useState<unknown>(null),
    [confirm, setConfirm] = useState(false);
  const refresh = useCallback(async () => {
    setData(await competitive.invoke<Dashboard>('league-admin', { action: 'admin_dashboard' }));
  }, []);
  useEffect(() => {
    let live = true;
    void competitive
      .invoke<Dashboard>('league-admin', { action: 'admin_dashboard' })
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(competitiveError(e));
      });
    void competitive
      .invoke<Metadata>('league-admin', { action: 'admin_economy_metadata' })
      .then((m) => {
        if (live) setMeta(m);
      })
      .catch(() => {
        /* Economic setup can be unavailable while incident controls remain usable. */
      });
    void competitive
      .invoke<Metrics>('league-admin', { action: 'admin_metrics' })
      .then((m) => {
        if (live) setMetrics(m);
      })
      .catch(() => {
        /* The dashboard reports current job and incident status independently. */
      });
    return () => {
      live = false;
    };
  }, []);

  const run = async (action: string, args: Record<string, unknown> = {}) => {
    setBusy(true);
    setError('');
    try {
      const result = await competitive.invoke('league-admin', { action, ...args });
      await refresh();
      return result;
    } catch (e) {
      setError(competitiveError(e));
    } finally {
      setBusy(false);
    }
  };
  const season = data?.seasons.find((s) => s.id === selected);
  const reasonValid = reason.trim().length >= 10;
  const create = () => {
    if (!meta) return;
    try {
      void run('admin_create_season', {
        name,
        startsAt: new Date(start).toISOString(),
        budgetAtomic: parseGem(budget, meta.tokenDecimals),
        poolAddress: pool,
        chainId: meta.chainId,
      });
    } catch (e) {
      setError(competitiveError(e));
    }
  };
  return (
    <PageShell contentClassName="space-y-6">
      <Link to="/competition" className="text-cyan-200">
        ← Modos de jogo
      </Link>
      <h1 className="text-4xl font-bold">Administração da liga</h1>
      {error ? (
        <p role="alert" className="text-red-200">
          {error}
        </p>
      ) : null}
      {data ? (
        <>
          <Panel className="space-y-4 p-6">
            <h2 className="text-2xl font-bold">Operação</h2>
            <label className="block">
              Motivo para alterações e decisões
              <textarea
                className="mt-2 w-full rounded bg-slate-950 p-3"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={4000}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ['leagueEntries', 'league_entries', 'Entradas na liga'],
                  ['wagerEntries', 'wager_entries', 'Novos duelos com aposta'],
                  ['casualEntries', 'casual_entries', 'Encontros casuais'],
                  ['commandsEnabled', 'commands_enabled', 'Jogadas em curso'],
                ] as const
              ).map(([key, field, label]) => (
                <ArenaButton
                  key={key}
                  loading={busy}
                  disabled={!reasonValid}
                  variant="secondary"
                  onClick={() => void run('admin_controls', { [key]: !data.controls[field], reason })}
                >
                  {data.controls[field] ? 'Suspender' : 'Permitir'} {label}
                </ArenaButton>
              ))}
            </div>
            <p>
              Os levantamentos e reembolsos mantêm-se disponíveis. Retomar as jogadas permite retomar cada
              partida suspensa após revisão.
            </p>
          </Panel>
          <Panel className="space-y-4 p-6">
            <h2 className="text-2xl font-bold">Preparar temporada</h2>
            <p>
              O orçamento e o início são obrigatórios. As condições ficam fixas durante 28 dias, seguidas de
              48 horas de revisão.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Nome', name, setName, 'text'],
                ['Início no teu fuso horário', start, setStart, 'datetime-local'],
                ['Fundo GEM', budget, setBudget, 'text'],
                ['Contrato do fundo', pool, setPool, 'text'],
              ].map(([label, value, setter, type]) => (
                <label className="block" key={label as string}>
                  {label as string}
                  <input
                    className="mt-2 w-full rounded bg-slate-950 p-3"
                    type={type as string}
                    value={value as string}
                    onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                  />
                </label>
              ))}
            </div>
            <ArenaButton
              loading={busy}
              disabled={!meta || !name.trim() || !start || !budget || !/^0x[0-9a-f]{40}$/i.test(pool)}
              onClick={create}
            >
              Guardar condições da temporada
            </ArenaButton>
          </Panel>
          <label className="block">
            Temporada
            <select
              className="ml-3 rounded bg-slate-950 p-3"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setPrepared(null);
                setConfirm(false);
              }}
            >
              <option value="">Selecionar</option>
              {data.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.status}
                </option>
              ))}
            </select>
          </label>
          {season ? (
            <Panel className="space-y-4 p-6">
              <h2 className="text-2xl font-bold">{season.name}</h2>
              <p>
                {localDate(season.starts_at)} — {localDate(season.ends_at)} ·{' '}
                {formatGem(season.budget_atomic, season.terms.tokenDecimals)} GEM · financiamento{' '}
                {season.funding_status}
              </p>
              <p>Reclamações até {localDate(season.review_ends_at)}.</p>
              <div className="flex flex-wrap gap-3">
                <ArenaButton
                  loading={busy}
                  disabled={season.status !== 'funded'}
                  onClick={() => void run('admin_activate', { seasonId: selected })}
                >
                  Abrir temporada financiada
                </ArenaButton>
                <ArenaButton
                  loading={busy}
                  disabled={season.status !== 'review' || season.distribution_frozen}
                  onClick={() => void run('admin_prepare_prizes', { seasonId: selected })}
                >
                  Calcular lista de prémios
                </ArenaButton>
              </div>
              {season.distribution ? (
                <>
                  <h3 className="text-xl font-bold">Distribuição para aprovação</h3>
                  <ul className="space-y-2">
                    {season.distribution.map((a) => (
                      <li key={a.playerId} className="break-all">
                        {a.beneficiary} · {formatGem(a.amountAtomic, season.terms.tokenDecimals)} GEM
                      </li>
                    ))}
                  </ul>
                  <label className="flex gap-3">
                    <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                    Conferi os beneficiários, os montantes e as reclamações resolvidas.
                  </label>
                  <ArenaButton
                    loading={busy}
                    disabled={!confirm || season.distribution_frozen}
                    onClick={() => void run('admin_approve_distribution', { seasonId: selected })}
                  >
                    {season.distribution_frozen ? 'Distribuição aprovada' : 'Aprovar distribuição definitiva'}
                  </ArenaButton>
                </>
              ) : null}
              <div className="space-y-3">
                <label>
                  Operação da multisig
                  <select
                    className="ml-3 rounded bg-slate-950 p-3"
                    value={kind}
                    onChange={(e) => {
                      setKind(e.target.value as 'fund' | 'finalize' | 'sweep');
                      setPrepared(null);
                    }}
                  >
                    <option value="fund">Financiamento</option>
                    <option value="finalize">Finalização dos prémios</option>
                    <option value="sweep">Devolução de saldos após o prazo</option>
                  </select>
                </label>
                <p>A aplicação prepara a transação. A organização confere e assina na sua multisig.</p>
                <ArenaButton
                  loading={busy}
                  onClick={() =>
                    void run('admin_pool_transaction', { seasonId: selected, kind }).then((result) => {
                      if (result) setPrepared(result);
                    })
                  }
                >
                  Preparar transação para conferência
                </ArenaButton>
                {prepared ? (
                  <details open>
                    <summary>Transação preparada</summary>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-950 p-4 text-xs">
                      {JSON.stringify(prepared, null, 2)}
                    </pre>
                  </details>
                ) : null}
                <label className="block">
                  Hash da transação submetida
                  <input
                    className="mt-2 w-full rounded bg-slate-950 p-3"
                    value={tx}
                    onChange={(e) => setTx(e.target.value)}
                  />
                </label>
                <ArenaButton
                  loading={busy}
                  disabled={!/^0x[0-9a-f]{64}$/i.test(tx)}
                  onClick={() =>
                    void run('admin_verify_transaction', { seasonId: selected, kind, txHash: tx })
                  }
                >
                  Confirmar na rede
                </ArenaButton>
              </div>
              <label className="block">
                Partida a invalidar
                <input
                  className="mt-2 w-full rounded bg-slate-950 p-3"
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                />
              </label>
              <ArenaButton
                variant="ghost"
                loading={busy}
                disabled={!matchId || !reasonValid || season.distribution_frozen}
                onClick={() => void run('admin_invalidate_result', { seasonId: selected, matchId, reason })}
              >
                Invalidar com motivo e recalcular Elo
              </ArenaButton>
              <label className="block">
                Conta a rever para elegibilidade de prémios
                <input
                  className="mt-2 w-full rounded bg-slate-950 p-3"
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  placeholder="Identificador da conta"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                {[true, false].map((sanctioned) => (
                  <ArenaButton
                    key={String(sanctioned)}
                    variant="ghost"
                    loading={busy}
                    disabled={!playerId || !reasonValid || season.distribution_frozen}
                    onClick={() =>
                      void run('admin_sanction', { seasonId: selected, playerId, sanctioned, reason })
                    }
                  >
                    {sanctioned ? 'Aplicar sanção com motivo' : 'Retirar sanção com motivo'}
                  </ArenaButton>
                ))}
              </div>
            </Panel>
          ) : null}
          <Panel className="space-y-4 p-6">
            <h2 className="text-2xl font-bold">Reclamações abertas</h2>
            {data.disputes.length ? (
              data.disputes.map((d) => (
                <div className="space-y-2" key={d.id}>
                  <p>{d.reason}</p>
                  <ArenaButton
                    size="sm"
                    loading={busy}
                    disabled={!reasonValid}
                    onClick={() =>
                      void run('admin_resolve_dispute', { seasonId: d.season_id, disputeId: d.id, reason })
                    }
                  >
                    Resolver com motivo
                  </ArenaButton>
                </div>
              ))
            ) : (
              <p>Sem reclamações pendentes.</p>
            )}
          </Panel>
          <Panel className="space-y-4 p-6">
            <h2 className="text-2xl font-bold">Partidas em revisão e pagamentos pendentes</h2>
            {data.matches.map((m) => (
              <div className="space-y-2" key={m.id}>
                <p className="break-all">
                  {m.id} · {m.mode} · {m.status} · {m.settlementStatus}
                </p>
                <Link className="text-cyan-200 underline" to={`/replay/${m.id}`}>
                  Rever eventos
                </Link>
                {m.status === 'suspended' ? (
                  <ArenaButton
                    size="sm"
                    loading={busy}
                    disabled={!reasonValid}
                    onClick={() => void run('admin_resume', { matchId: m.id, reason })}
                  >
                    Retomar partida revista
                  </ArenaButton>
                ) : null}
              </div>
            ))}
            <p>
              {data.jobs.length} tarefas pendentes. {data.jobs.filter((j) => j.last_error).length} tarefas com
              erro registado.
            </p>
            {data.jobs
              .filter((job) => job.state === 'review')
              .map((job) => (
                <div key={job.id} className="space-y-2">
                  <p>
                    Tarefa {job.id} · {job.kind} · {job.attempts} tentativas · {job.last_error}
                  </p>
                  <ArenaButton
                    size="sm"
                    disabled={!reasonValid}
                    loading={busy}
                    onClick={() => void run('admin_retry_job', { jobId: job.id, reason })}
                  >
                    Repetir após revisão da falha
                  </ArenaButton>
                </div>
              ))}
          </Panel>
          {metrics ? (
            <Panel className="space-y-3 p-6">
              <h2 className="text-2xl font-bold">Métricas operacionais</h2>
              <p>
                {metrics.queueCount} na fila · espera mais antiga: {Math.round(metrics.oldestQueueSeconds)}s ·{' '}
                {metrics.confirmationMisses24h} confirmações falhadas e {metrics.selectionMisses24h} seleções
                incompletas nas últimas 24 horas.
              </p>
              <p>
                Duração mediana: {Math.round(metrics.medianMatchSeconds ?? 0)}s · desistências:{' '}
                {metrics.resignations} · derrotas por tempo: {metrics.timeouts} · conflitos de versão:{' '}
                {metrics.versionConflicts24h}.
              </p>
              <p>
                Vitórias de quem começa:{' '}
                {metrics.firstPlayerWinRate === null
                  ? 'sem dados'
                  : `${Math.round(metrics.firstPlayerWinRate * 100)}%`}{' '}
                · operação económica pendente mais antiga:{' '}
                {Math.round(metrics.oldestPendingTransactionSeconds)}s · última passagem do reconciliador:{' '}
                {Math.round(metrics.heartbeatAgeSeconds)}s.
              </p>
              <p>
                {metrics.reviewSignals.length} pares com padrões de desistência a rever. Estes sinais não
                aplicam sanções automaticamente.
              </p>
              <details>
                <summary>Desempenho por criatura e trio</summary>
                <ul className="space-y-2">
                  {metrics.creatures.map((c) => (
                    <li key={c.creature}>
                      {c.creature}: {c.games} jogos · {Math.round(c.score * 100)}% de pontos
                    </li>
                  ))}
                </ul>
                <ul className="mt-4 space-y-2">
                  {metrics.trios.map((t) => (
                    <li key={t.trio.join(',')}>
                      {t.trio.join(' / ')}: {t.games} jogos · {Math.round(t.score * 100)}% de pontos
                    </li>
                  ))}
                </ul>
              </details>
            </Panel>
          ) : null}
          <details>
            <summary className="cursor-pointer text-cyan-200">Histórico de decisões</summary>
            <ul className="mt-3 space-y-2 text-sm">
              {data.audit.map((a) => (
                <li key={a.id}>
                  {localDate(a.created_at)} · {a.action} · {a.reason}
                </li>
              ))}
            </ul>
          </details>
          <ArenaButton
            variant="ghost"
            onClick={() => void refresh().catch((e) => setError(competitiveError(e)))}
          >
            Atualizar painel
          </ArenaButton>
        </>
      ) : (
        <p>A verificar o acesso à administração…</p>
      )}
    </PageShell>
  );
}
