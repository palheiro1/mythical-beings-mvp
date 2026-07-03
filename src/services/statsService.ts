import { PLAYHUB_COMPETITIVE_MODE_ID, supabase } from '../utils/supabaseClient.js';
import { getPlayHubSession, finishPlayHubSession, settleCompetitionSession } from './sessionService.js';
import { GameState } from '../game/types.js';

export const COMPETITION_SETTLEMENT_EVENT = 'wisdom-duel:competition-settlement';

const COMPETITION_SETTLEMENT_STORAGE_PREFIX = 'wisdom-duel.competitionSettlement.';

export type CompetitionSettlementNotice = {
  sessionId: string;
  status: 'failed' | 'settled';
  error?: string;
  txHash?: string;
  updatedAt: number;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(999, Math.round(value)));
}

function getSettlementStorageKey(sessionId: string): string {
  return `${COMPETITION_SETTLEMENT_STORAGE_PREFIX}${sessionId}`;
}

function emitCompetitionSettlementNotice(notice: CompetitionSettlementNotice): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CompetitionSettlementNotice>(COMPETITION_SETTLEMENT_EVENT, { detail: notice }));
}

function getErrorMessage(error: unknown, fallback: string): string {
  const maybeError = error as { message?: unknown };
  return typeof maybeError?.message === 'string' && maybeError.message ? maybeError.message : fallback;
}

function storeCompetitionSettlementFailure(sessionId: string, error: unknown): CompetitionSettlementNotice {
  const notice: CompetitionSettlementNotice = {
    sessionId,
    status: 'failed',
    error: getErrorMessage(error, 'Competitive GEM settlement failed.'),
    updatedAt: Date.now(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(getSettlementStorageKey(sessionId), JSON.stringify(notice));
    } catch {
      // Settlement retry still emits an in-memory UI event when browser storage is unavailable.
    }
  }

  emitCompetitionSettlementNotice(notice);
  return notice;
}

function clearCompetitionSettlementFailure(sessionId: string, txHash?: string): CompetitionSettlementNotice {
  const notice: CompetitionSettlementNotice = {
    sessionId,
    status: 'settled',
    txHash,
    updatedAt: Date.now(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(getSettlementStorageKey(sessionId));
    } catch {
      // Ignore storage cleanup failures; the settlement tx is already submitted.
    }
  }

  emitCompetitionSettlementNotice(notice);
  return notice;
}

export function getPendingCompetitionSettlement(sessionId: string): CompetitionSettlementNotice | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(getSettlementStorageKey(sessionId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CompetitionSettlementNotice;
    return parsed?.status === 'failed' && parsed.sessionId === sessionId ? parsed : null;
  } catch {
    window.sessionStorage.removeItem(getSettlementStorageKey(sessionId));
    return null;
  }
}

export async function retryCompetitionSettlement(sessionId: string): Promise<{ txHash: string }> {
  try {
    const settlement = await settleCompetitionSession(sessionId);
    clearCompetitionSettlementFailure(sessionId, settlement.txHash);
    return { txHash: settlement.txHash };
  } catch (error) {
    storeCompetitionSettlementFailure(sessionId, error);
    throw error;
  }
}

export async function recordGameOutcomeAndUpdateStats(
  sessionId: string,
  winnerId: string | null,
  player1Id: string,
  player2Id: string,
  gameState?: GameState | null,
): Promise<void> {
  const { data: authData } = await supabase.auth.getSession();
  const currentUserId = authData.session?.user?.id;
  if (!currentUserId) return;

  const session = await getPlayHubSession(sessionId);
  if (!session || session.status !== 'playing') return;
  if (session.host_id !== currentUserId) {
    console.log('[recordGameOutcome] Skipping finish: only host finalizes Play Hub sessions.');
    return;
  }

  const participants = (session.participants ?? []).slice().sort((a, b) => a.slot - b.slot);
  if (participants.length !== 2) {
    console.error('[recordGameOutcome] Cannot finish: expected exactly two human participants.', participants);
    return;
  }

  const powerByPlayer = new Map<string, number>();
  gameState?.players?.forEach((player) => powerByPlayer.set(player.id, clampScore(player.power)));

  const isDraw = winnerId === null;
  const results = participants.map((participant) => {
    const isWinner = !isDraw && participant.player_id === winnerId;
    const rank = isDraw ? participant.slot + 1 : (isWinner ? 1 : 2);
    const score = isDraw ? 0 : clampScore(powerByPlayer.get(participant.player_id) ?? (isWinner ? 1 : 0));

    return {
      player_id: participant.player_id,
      rank,
      score,
      result_payload: {
        outcome: isDraw ? 'draw' : (isWinner ? 'win' : 'loss'),
        slot: participant.slot,
        reported_by: currentUserId,
        player1_id: player1Id,
        player2_id: player2Id,
      },
    };
  });

  const finished = await finishPlayHubSession(sessionId, results);
  if (finished) {
    console.log('[recordGameOutcome] Play Hub session finished:', sessionId);
    if (session.mode_id === PLAYHUB_COMPETITIVE_MODE_ID) {
      try {
        const settlement = await settleCompetitionSession(sessionId);
        clearCompetitionSettlementFailure(sessionId, settlement.txHash);
        console.log('[recordGameOutcome] Competitive GEM settlement submitted:', settlement.txHash);
      } catch (error) {
        storeCompetitionSettlementFailure(sessionId, error);
        console.error('[recordGameOutcome] Competitive GEM settlement failed:', error);
      }
    }
  }
}

export async function logMove(_sessionId: string, _playerId: string, _action: string, _payload: any): Promise<void> {
  // The Play Hub core persists authoritative results only. Detailed move logs remain in GameState.log.
}
