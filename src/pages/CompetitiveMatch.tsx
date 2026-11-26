import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  CompetitiveCommand,
  CompetitiveProjection,
  Creature,
  Knowledge,
} from '@mythicalb/wisdom-duel-engine';
import { creatures } from '@mythicalb/wisdom-duel-engine/catalog';
import CardFaceByImage from '../components/CardFaceByImage.js';
import ChallengeArena from '../components/competition/ChallengeArena.js';
import { ArenaButton, PageShell, Panel } from '../components/ui/index.js';
import { useTrainingMotion } from '../hooks/useTrainingMotion.js';
import { cardAnchor } from '../game/presentation.js';
import ActionLights from '../components/game/ActionLights.js';
import DuelTargetChoices from '../components/game/DuelTargetChoices.js';
import DuelEffectHistory from '../components/game/DuelEffectHistory.js';
import { CreatureStatus } from '../components/training/TrainingBoard.js';
import { useAuth } from '../hooks/useAuth.js';
import { useCompetitiveMatch, useMatchClock } from '../hooks/useCompetitiveMatch.js';
import {
  competitive,
  competitiveError,
  competitiveWalletConfig,
  formatGem,
  type WisdomMatchView,
} from '../services/competitiveService.js';

function ClockDisplay({ projection, playerId }: { projection: CompetitiveProjection; playerId: string }) {
  const clock = useMatchClock(projection);
  const label = (id: string) => {
    const seconds = Math.ceil(clock(id) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  return (
    <div className="flex flex-wrap gap-5 text-xl tabular-nums" aria-label="Relógios da partida">
      {projection.players.map((p) => (
        <span
          key={p.id}
          className={projection.clock.runningPlayerId === p.id ? 'text-amber-200' : 'text-slate-300'}
        >
          {p.id === playerId ? 'Tu' : 'Adversário'}: <strong>{label(p.id)}</strong>
        </span>
      ))}
      {projection.clock.suspendedAt ? <strong>Suspensa</strong> : null}
    </div>
  );
}
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
function Card({ card, owner = '', children }: { card: Creature | Knowledge; owner?: string; children?: React.ReactNode }) {
  return (
    <div data-motion-anchor={cardAnchor(owner,card)} data-motion-face className="w-32 shrink-0 space-y-2 sm:w-40">
      <CardFaceByImage card={card} src={card.image} alt={card.name} />
      <p className="text-sm font-semibold">{card.name}</p>
      {children}
    </div>
  );
}
function Board({
  projection,
  playerId,
  disabled,
  send: submit,
}: {
  projection: CompetitiveProjection;
  playerId: string;
  disabled: boolean;
  send: (command: CompetitiveCommand) => Promise<unknown>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const motion = useTrainingMotion(projection, root, layer, 'classic', false, undefined, true, playerId);
  function send(command: CompetitiveCommand) {
    motion.finish();
    motion.capture();
    return submit(command);
  }
  const [selected, setSelected] = useState<Knowledge | null>(null);
  const mine = projection.players.find((p) => p.id === playerId)!,
    rival = projection.players.find((p) => p.id !== playerId)!;
  const canAct =
    !disabled &&
    !projection.outcome &&
    !projection.clock.suspendedAt &&
    !projection.pendingEffect &&
    projection.currentPlayerId === playerId &&
    projection.decisionPlayerId === playerId;
  const canSpend = canAct && projection.actionsTakenThisTurn < projection.actionsPerTurn;
  const lights = !projection.outcome && <ActionLights owner={projection.currentPlayerId} remaining={Math.max(0, projection.actionsPerTurn - projection.actionsTakenThisTurn)} total={projection.actionsPerTurn} />;
  const hand = mine.hand.visibility === 'visible' ? mine.hand.cards : [];
  const chosen = selected && hand.some((k) => k.instanceId === selected.instanceId) ? selected : null;
  async function summon(creatureId: string) {
    if (!chosen?.instanceId) return;
    const result = await send({
      type: 'summon_knowledge',
      creatureId,
      handInstanceId: chosen.instanceId,
    });
    if (result === 'accepted' || result === 'duplicate') setSelected(null);
  }
  return (
    <div className="space-y-5" ref={root}>
      <div className="wd-motion-layer" ref={layer} aria-hidden="true" inert />
      {motion.summary && <p role="status" aria-label="Latest effects" className="wd-effect-summary wd-classic-summary">{motion.summary}</p>}
      <Panel className="space-y-3 p-4">
        <h2 className="text-xl font-bold">
          Adversário · <strong data-motion-anchor={`power:${rival.id}`}>{rival.power}</strong> Power · <span data-motion-anchor={`hand:${rival.id}`}>{rival.hand.count} cartas na mão</span> {projection.currentPlayerId === rival.id && lights}
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {rival.creatures.map((c) => (
            <div key={c.id} data-motion-anchor={`slot:${rival.id}:${c.id}`} className="space-y-2">
              <CreatureStatus owl={rival.field.some(s => s.knowledge?.id === 'aerial3')} hurricane={mine.field[rival.creatures.indexOf(c)]?.knowledge?.id === 'aquatic3'} />
              <Card owner={rival.id} card={c} />
              {rival.field.find((f) => f.creatureId === c.id)?.knowledge ? (
                <Card card={rival.field.find((f) => f.creatureId === c.id)!.knowledge!} />
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="space-y-3 p-4">
        <h2 data-motion-anchor="market" className="text-xl font-bold">Mercado · {projection.deckCount} cartas no baralho</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {projection.market.map((k) => (
            <Card key={k.instanceId} card={k}>
              <ArenaButton
                size="sm"
                fullWidth
                disabled={!canSpend}
                onClick={() =>
                  void send({
                    type: 'draw_knowledge',
                    marketInstanceId: k.instanceId!,
                  })
                }
              >
                Tirar do Mercado
              </ArenaButton>
            </Card>
          ))}
        </div>
      </Panel>
      <Panel className="space-y-3 p-4">
        <h2 className="text-xl font-bold">A tua equipa · <strong data-motion-anchor={`power:${mine.id}`}>{mine.power}</strong> Power {projection.currentPlayerId === mine.id && lights}</h2>
        {chosen ? (
          <p role="status" className="text-amber-200">
            Escolhe a criatura em que vais jogar {chosen.name}. Uma carta já nesse espaço será descartada.{' '}
            <button className="underline" onClick={() => setSelected(null)}>
              Cancelar seleção
            </button>
          </p>
        ) : null}
        <div className="flex gap-5 overflow-x-auto pb-2">
          {mine.creatures.map((c) => {
            const knowledge = mine.field.find((f) => f.creatureId === c.id)?.knowledge;
            return (
              <div key={c.id} data-motion-anchor={`slot:${mine.id}:${c.id}`} className="space-y-3">
                <CreatureStatus owl={mine.field.some(s => s.knowledge?.id === 'aerial3')} hurricane={rival.field[mine.creatures.indexOf(c)]?.knowledge?.id === 'aquatic3'} />
                <Card owner={mine.id} card={c}>
                  <ArenaButton
                    size="sm"
                    fullWidth
                    disabled={!canSpend}
                    onClick={() =>
                      chosen
                        ? void summon(c.id)
                        : void send({
                            type: 'rotate_creature',
                            creatureId: c.id,
                          })
                    }
                  >
                    {chosen ? 'Jogar aqui' : 'Rodar criatura'}
                  </ArenaButton>
                </Card>
                {knowledge ? (
                  <Card card={knowledge}>
                    <ArenaButton
                      size="sm"
                      fullWidth
                      disabled={!canSpend}
                      onClick={() =>
                        void send({
                          type: 'rotate_knowledge',
                          creatureId: c.id,
                          fieldInstanceId: knowledge.instanceId!,
                        })
                      }
                    >
                      Rodar carta de Conhecimento
                    </ArenaButton>
                  </Card>
                ) : (
                  <p className="text-sm text-slate-400">Espaço livre</p>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel className="space-y-3 p-4">
        <h2 data-motion-anchor={`hand:${mine.id}`} className="text-xl font-bold">A tua mão</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {hand.map((k) => (
            <Card key={k.instanceId} card={k}>
              <ArenaButton
                size="sm"
                fullWidth
                disabled={!canSpend}
                aria-pressed={chosen?.instanceId === k.instanceId}
                variant={chosen?.instanceId === k.instanceId ? 'primary' : 'secondary'}
                onClick={() => setSelected(chosen?.instanceId === k.instanceId ? null : k)}
              >
                {chosen?.instanceId === k.instanceId ? 'Selecionado' : 'Selecionar'}
              </ArenaButton>
            </Card>
          ))}
        </div>
        {hand.length === 0 ? <p>A tua mão está vazia. Tira uma carta de Conhecimento do Mercado.</p> : null}
      </Panel>
      {projection.pendingEffect ? (
        <Panel className="space-y-3 border-amber-300 p-5" role="region" aria-label="Decisão pendente">
          <h2 className="text-xl font-bold">{projection.pendingEffect.prompt}</h2>
          <DuelTargetChoices view={projection} board={root} className="flex flex-wrap gap-3">
            {projection.pendingEffect.choices.map((choice, index) => (
              <ArenaButton
                key={choice.key}
                data-choice-index={index}
                disabled={
                  disabled ||
                  Boolean(projection.clock.suspendedAt) ||
                  projection.decisionPlayerId !== playerId
                }
                onClick={() =>
                  void send({
                    type: 'resolve_pending_effect',
                    effectId: projection.pendingEffect!.id,
                    choiceKey: choice.key,
                  })
                }
              >
                {choice.label}
              </ArenaButton>
            ))}
            {projection.pendingEffect.optional ? (
              <ArenaButton
                variant="ghost"
                disabled={
                  disabled ||
                  Boolean(projection.clock.suspendedAt) ||
                  projection.decisionPlayerId !== playerId
                }
                onClick={() =>
                  void send({
                    type: 'resolve_pending_effect',
                    effectId: projection.pendingEffect!.id,
                    skip: true,
                  })
                }
              >
                Passar efeito
              </ArenaButton>
            ) : null}
          </DuelTargetChoices>
        </Panel>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <ArenaButton disabled={!canAct} onClick={() => void send({ type: 'end_turn' })}>
          Terminar turno
        </ArenaButton>
        <p>
          {projection.decisionPlayerId === playerId ? 'A tua decisão' : 'À espera do adversário'} · turno{' '}
          {projection.turn} · {projection.actionsTakenThisTurn}/{projection.actionsPerTurn} ações
        </p>
      </div>
      <details>
        <summary data-motion-anchor="discard" className="cursor-pointer text-cyan-200">Descartes e acontecimentos públicos</summary>
        <p>{projection.discardPile.map((k) => k.name).join(', ') || 'Sem descartes.'}</p>
        <DuelEffectHistory events={projection.events} viewer={playerId} />
      </details>
    </div>
  );
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
      {match.status === 'waiting' ? (
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
          Cancelar preparação
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
  const [confirmResign, setConfirmResign] = useState(false);
  const projection = data?.projection;
  const challengeId = challengeMatchId(data?.match);
  const standingsPath = challengeId ? `/challenge?period=${challengeId}` : '/standings';
  if (projection && challengeId && user) {
    return <ChallengeArena key={matchId} projection={projection} playerId={user.id} standingsPath={standingsPath}
      sending={sending} retryable={retryable} error={error} send={submit} />;
  }
  return (
    <PageShell contentClassName="space-y-5">
      <Link className="text-cyan-200" to={challengeId ? standingsPath : '/competition'}>
        {challengeId ? '← Challenge standings' : '← Game modes'}
      </Link>
      <h1 className="text-3xl font-bold">
        {!data ? 'Duel' : challengeId ? 'Weekly Challenge duel' : data.match.mode === 'league'
          ? 'Partida da liga'
          : data?.match.mode === 'wager'
            ? 'Duelo com aposta'
            : 'Encontro casual'}
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
      {projection ? (
        <>
          <ClockDisplay projection={projection} playerId={user!.id} />
          {projection.outcome ? (
            <Panel className="space-y-3 p-6" role="status">
              <h2 className="text-3xl font-bold">
                {projection.outcome.winnerId === null
                  ? 'Empate'
                  : projection.outcome.winnerId === user?.id
                    ? 'Vitória'
                    : 'Derrota'}
              </h2>
              <p>
                {
                  {
                    timeout: 'Tempo esgotado.',
                    resign: 'Desistência.',
                    power: 'Batalha concluída.',
                    draw: 'Batalha empatada.',
                  }[projection.outcome.reason]
                }
              </p>
              <Link className="text-cyan-200 underline" to={`/replay/${matchId}`}>
                Ver replay completo
              </Link>{' '}
              ·{' '}
              <Link className="text-cyan-200 underline" to={standingsPath}>
                Classificação
              </Link>
            </Panel>
          ) : null}
          {projection.clock.suspendedAt ? (
            <p role="status">
              A partida está suspensa por um incidente técnico. A organização irá rever e retomar o encontro
              com o tempo preservado.
            </p>
          ) : null}
          <Board projection={projection} playerId={user!.id} disabled={sending || retryable} send={submit} />
          {!projection.outcome && !projection.clock.suspendedAt ? (
            <div className="space-y-3">
              {confirmResign ? (
                <div role="alert">
                  <p>
                    Desistir conta como derrota
                    {projection.mode === 'wager' ? ' e implica perder a aposta e uma carta' : ''}.
                  </p>
                  <div className="mt-3 flex gap-3">
                    <ArenaButton
                      variant="danger"
                      disabled={sending || retryable}
                      onClick={() => void submit({ type: 'resign' }).then(() => setConfirmResign(false))}
                    >
                      Confirmar desistência
                    </ArenaButton>
                    <ArenaButton variant="ghost" onClick={() => setConfirmResign(false)}>
                      Continuar a jogar
                    </ArenaButton>
                  </div>
                </div>
              ) : (
                <ArenaButton
                  variant="ghost"
                  disabled={sending || retryable}
                  onClick={() => setConfirmResign(true)}
                >
                  Desistir
                </ArenaButton>
              )}
            </div>
          ) : null}
        </>
      ) : null}
      {data && (!projection || (projection.outcome && data.match.mode === 'wager')) ? (
        <Preparation match={data.match} serverNow={data.serverNow} refresh={refresh} />
      ) : null}
    </PageShell>
  );
}
