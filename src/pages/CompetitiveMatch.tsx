import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type {
  Creature,
} from '@mythicalb/wisdom-duel-engine';
import { creatures } from '@mythicalb/wisdom-duel-engine/catalog';
import CardFaceByImage from '../components/CardFaceByImage.js';
import ChallengeArena from '../components/competition/ChallengeArena.js';
import DuelInvitation from '../components/competition/DuelInvitation.js';
import { ArenaButton, PageShell, Panel } from '../components/ui/index.js';
import { useAuth } from '../hooks/useAuth.js';
import { useCompetitiveMatch } from '../hooks/useCompetitiveMatch.js';
import {
  competitive,
  competitiveError,
  competitiveWalletConfig,
  formatGem,
  type WisdomMatchView,
} from '../services/competitiveService.js';

function Countdown({ deadline, serverNow }: { deadline: string; serverNow: string }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const start = performance.now(),
      initial = Date.parse(deadline) - Date.parse(serverNow);
    const update = () => setRemaining(Math.max(0, Math.ceil((initial - (performance.now() - start)) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deadline, serverNow]);
  return <span className="tabular-nums">{remaining}s</span>;
}
function Preparation({
  match,
  serverNow,
  refresh,
}: {
  match: WisdomMatchView;
  serverNow: string;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [acknowledged, setAcknowledged] = useState(false),
    [txHash, setTxHash] = useState(''),
    [deferredCards, setDeferredCards] = useState<{ cardId: string; amount: string }[] | null>(null),
    [cardRecipient, setCardRecipient] = useState(''),
    [cardClaimHash, setCardClaimHash] = useState('');
  const { polygonWallet, connectPolygonWallet, user } = useAuth();
  const { state: navigationState } = useLocation();
  const storageKey = `wisdom-economy:${user?.id}:${match.matchId}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setTxHash(JSON.parse(saved).txHash);
    } catch {
      /* optional recovery record */
    }
  }, [storageKey]);
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      await refresh();
    } catch (e) {
      setError(competitiveError(e));
    } finally {
      setBusy(false);
    }
  };
  const transact = async (kind: 'deposit' | 'lock' | 'settle' | 'refund') => {
    const { executeWisdomWager } = await import('@mythicalb/sdk/wisdom-duel-wallet');
    const result = await executeWisdomWager(
      competitive,
      competitiveWalletConfig(),
      match.matchId,
      kind,
      (hash) => {
        setTxHash(hash);
        try {
          localStorage.setItem(storageKey, JSON.stringify({ txHash: hash, kind }));
        } catch {
          /* Receipt can also be reconciled by the server. */
        }
      },
    );
    return result;
  };
  const retryReceipt = async () => {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (saved)
      await competitive.invoke('wager', {
        action: 'wager_verify',
        matchId: match.matchId,
        kind: saved.kind,
        txHash: saved.txHash,
      });
  };
  const outcomeFinished = match.status === 'finished';
  return (
    <Panel className="space-y-4 p-6">
      {match.status === 'waiting' && match.mode === 'casual' ? <DuelInvitation matchId={match.matchId} retryListing={navigationState?.retryListing === true} /> : null}
      {match.status === 'waiting' && match.mode === 'wager' ? (
        <>
          <h2 className="text-2xl font-bold">Convida um adversário</h2>
          <label className="block">
            Ligação da sala
            <input
              className="mt-2 w-full rounded border border-white/20 bg-slate-950 p-3"
              readOnly
              value={`${location.origin}/wagers?join=${match.matchId}&mode=${match.mode}`}
              onFocus={(e) => e.target.select()}
            />
          </label>
        </>
      ) : null}
      {match.status === 'confirming' ? (
        <>
          <p>
            Accept this duel within <Countdown deadline={match.deadline} serverNow={serverNow} />.
          </p>
          <ArenaButton
            disabled={match.accepted || busy}
            onClick={() => void run(() => competitive.queue('queue_accept', { matchId: match.matchId }))}
          >
            Accept duel
          </ArenaButton>
        </>
      ) : null}
      {match.mode === 'wager' ? (
        <>
          <p className="text-lg">
            Aposta por jogador:{' '}
            <strong>{formatGem(match.stakeAtomic ?? '0', match.tokenDecimals ?? 18)} GEM</strong>
          </p>
          {!polygonWallet ? (
            <ArenaButton loading={busy} onClick={() => void run(connectPolygonWallet)}>
              Associar carteira Polygon
            </ArenaButton>
          ) : null}
          {match.status === 'depositing' ? (
            <>
              <p>
                Se perderes, perdes a aposta GEM e uma das três cartas utilizadas. Perder a última cópia pode
                deixar a carteira abaixo do mínimo para outro duelo. A liga gratuita continua disponível.
              </p>
              {!match.deposited ? (
                <label className="flex gap-3">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  Compreendo a aposta e a possível perda de uma carta.
                </label>
              ) : null}
              <ArenaButton
                loading={busy}
                disabled={!polygonWallet || match.deposited || !acknowledged}
                onClick={() => void run(() => transact('deposit'))}
              >
                {match.deposited ? 'Depósito confirmado' : 'Depositar GEM'}
              </ArenaButton>
              <p>
                {match.opponentDeposited
                  ? 'O adversário já depositou.'
                  : 'À espera do depósito do adversário.'}
              </p>
            </>
          ) : null}
          {match.status === 'locking' ? (
            <>
              <p>As duas equipas estão fechadas. Cada jogador bloqueia agora as suas três cartas.</p>
              <ArenaButton
                loading={busy}
                disabled={match.locked}
                onClick={() => void run(() => transact('lock'))}
              >
                {match.locked ? 'Cartas bloqueadas' : 'Bloquear as três cartas'}
              </ArenaButton>
              <p>
                {match.opponentLocked
                  ? 'Cartas do adversário confirmadas.'
                  : 'À espera do bloqueio do adversário.'}
              </p>
            </>
          ) : null}
          {(outcomeFinished || match.status === 'cancelled') &&
          ['ready', 'refund_pending'].includes(match.settlementStatus) ? (
            <div className="flex flex-wrap gap-3">
              <ArenaButton
                loading={busy}
                onClick={() =>
                  void run(() =>
                    transact(
                      match.settlementStatus === 'refund_pending' || match.status === 'cancelled'
                        ? 'refund'
                        : 'settle',
                    ),
                  )
                }
              >
                Receber liquidação ou reembolso
              </ArenaButton>
            </div>
          ) : null}
          {['finalized', 'refunded'].includes(match.settlementStatus) ? (
            <div className="space-y-3">
              <p role="status">
                {match.settlementStatus === 'refunded' ? 'Reembolso confirmado.' : 'Liquidação confirmada.'}
              </p>
              <p>Se a tua carteira não conseguiu receber alguma carta, podes levantá-la separadamente.</p>
              <ArenaButton
                variant="ghost"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    const { getWisdomDeferredCards } = await import('@mythicalb/sdk/wisdom-duel-wallet');
                    setDeferredCards(await getWisdomDeferredCards(competitiveWalletConfig(), match.matchId));
                  })
                }
              >
                Verificar cartas por receber
              </ArenaButton>
              {deferredCards?.length === 0 ? (
                <p role="status">Não tens cartas pendentes neste duelo.</p>
              ) : null}
              {deferredCards && deferredCards.length > 0 ? (
                <>
                  <label className="block">
                    Carteira para receber as cartas (vazio para usar a carteira ligada)
                    <input
                      className="mt-2 w-full rounded border border-white/20 bg-slate-950 p-3"
                      value={cardRecipient}
                      onChange={(event) => setCardRecipient(event.target.value)}
                      placeholder="0x…"
                    />
                  </label>
                  <p>Usa uma carteira tua que aceite estas cartas. Confirma o endereço antes de autorizar.</p>
                  {deferredCards.map(({ cardId, amount }) => (
                    <ArenaButton
                      key={cardId}
                      loading={busy}
                      onClick={() =>
                        void run(async () => {
                          const { claimWisdomDeferredCard } =
                            await import('@mythicalb/sdk/wisdom-duel-wallet');
                          setCardClaimHash(
                            await claimWisdomDeferredCard(competitiveWalletConfig(), cardId, cardRecipient),
                          );
                        })
                      }
                    >
                      Levantar uma cópia da carta {cardId} ({amount} por receber)
                    </ArenaButton>
                  ))}
                </>
              ) : null}
              {cardClaimHash ? (
                <p role="status" className="break-all">
                  Levantamento enviado: {cardClaimHash}. Volta a verificar as cartas após a confirmação da
                  rede.
                </p>
              ) : null}
            </div>
          ) : null}
          {txHash ? (
            <div className="space-y-2">
              <p className="break-all text-sm">
                Transação enviada: {txHash}. A confirmação final da rede pode demorar.
              </p>
              <ArenaButton variant="ghost" loading={busy} onClick={() => void run(retryReceipt)}>
                Verificar confirmação
              </ArenaButton>
            </div>
          ) : null}
        </>
      ) : null}
      {match.status === 'selecting' ? (
        <>
          <h2 className="text-2xl font-bold">
            Choose three creatures · <Countdown deadline={match.deadline} serverNow={serverNow} />
          </h2>
          <p>Your team stays hidden until both players confirm. Once you confirm your team, your choices are final.</p>
          <p>When both teams are ready, anyone can watch the board. Your hand stays private. Each turn lasts 30 seconds. Missing two of your turns in a row without a move loses the duel.</p>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {(match.offer ?? []).map((id) => {
              const c = creatures.find((c) => c.id === id) as Creature | undefined;
              if (!c) return null;
              const chosen = (match.selection ?? selected).includes(id);
              return (
                <div className="w-36 shrink-0" key={id}>
                  <button
                    type="button"
                    className={`w-full rounded-xl p-2 focus:ring-2 focus:ring-cyan-200 ${chosen ? 'bg-amber-300/25 ring-2 ring-amber-300' : ''}`}
                    disabled={Boolean(match.selection) || busy || (!chosen && selected.length === 3)}
                    aria-pressed={chosen}
                    aria-label={`Select ${c.name}`}
                    onClick={() =>
                      setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
                    }
                  >
                    <CardFaceByImage card={c} src={c.image} alt={c.name} />
                    <span>{c.name}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <ArenaButton
            loading={busy}
            disabled={Boolean(match.selection) || selected.length !== 3}
            onClick={() => void run(() => competitive.selection(match.matchId, selected))}
          >
            {match.selection ? 'Team confirmed' : 'Confirm team'}
          </ArenaButton>
          <p>{match.opponentSelected ? 'Your opponent confirmed their team.' : 'Waiting for your opponent to choose a team.'}</p>
        </>
      ) : null}
      {['preparing', 'initializing'].includes(match.status) ? (
        <p role="status">Preparing the duel…</p>
      ) : null}
      {match.status === 'cancelled' ? (
        <p>
          This duel was cancelled before play and does not count toward the standings.
          {match.mode === 'wager' ? ' Deposited funds will be refunded.' : ''}
        </p>
      ) : null}
      {['waiting', 'depositing', 'selecting', 'locking'].includes(match.status) && match.mode !== 'league' && !challengeMatchId(match) ? (
        <ArenaButton
          variant="ghost"
          loading={busy}
          onClick={() => void run(() => competitive.cancelPreparation(match.matchId))}
        >
          {match.mode === 'casual' ? 'Cancel duel' : 'Cancelar preparação'}
        </ArenaButton>
      ) : null}
      {error ? (
        <p role="alert" className="text-red-200">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}

function challengeMatchId(match: WisdomMatchView | undefined) {
  return match && 'challengeId' in match && typeof match.challengeId === 'string' ? match.challengeId : null;
}

export default function CompetitiveMatch() {
  const { matchId = '' } = useParams(),
    { user } = useAuth();
  const { data, error, sending, retryable, refresh, submit } = useCompetitiveMatch(matchId, user?.id ?? '');
  const projection = data?.projection;
  const challengeId = challengeMatchId(data?.match);
  const standingsPath = challengeId ? `/challenge?period=${challengeId}` : '/standings';
  const casualDuel = data?.match.mode === 'casual' && !challengeId;
  const lobbyPath = casualDuel ? '/duels/public' : data?.match.mode === 'wager' ? '/wagers' : standingsPath;
  if (projection && user && data) {
    return <>
      <ChallengeArena key={matchId} projection={projection} playerId={user.id} lobbyPath={lobbyPath} casualDuel={casualDuel}
        sending={sending} retryable={retryable} error={error} send={submit} />
      {projection.outcome && data.match.mode === 'wager' && <PageShell><Preparation match={data.match} serverNow={data.serverNow} refresh={refresh} /></PageShell>}
    </>;
  }
  return (
    <PageShell contentClassName="space-y-5">
      <Link className="text-cyan-200" to={casualDuel || challengeId ? lobbyPath : '/competition'}>
        {casualDuel ? '← Player duels' : challengeId ? '← Challenge standings' : '← Game modes'}
      </Link>
      <h1 className="text-3xl font-bold">
        {!data ? 'Duel' : challengeId ? 'Weekly Challenge duel' : data.match.mode === 'league'
          ? 'Partida da liga'
          : data?.match.mode === 'wager'
            ? 'Duelo com aposta'
            : 'Casual duel'}
      </h1>
      {!data ? <p>Loading your duel…</p> : null}
      {error ? (
        <p role="alert" className="rounded border border-red-400/40 bg-red-950/40 p-3 text-red-100">
          {error}
        </p>
      ) : null}
      {retryable ? (
        <ArenaButton loading={sending} onClick={() => void submit()}>
          Check submitted move
        </ArenaButton>
      ) : null}
      {data && (!projection || (projection.outcome && data.match.mode === 'wager')) ? (
        <Preparation match={data.match} serverNow={data.serverNow} refresh={refresh} />
      ) : null}
    </PageShell>
  );
}
