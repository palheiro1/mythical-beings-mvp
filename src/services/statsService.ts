import { supabase } from '../utils/supabaseClient.js';
import { getPlayHubSession, finishPlayHubSession } from './sessionService.js';
import { GameState } from '../game/types.js';

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(999, Math.round(value)));
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
  }
}

export async function logMove(_sessionId: string, _playerId: string, _action: string, _payload: any): Promise<void> {
  // The Play Hub core persists authoritative results only. Detailed move logs remain in GameState.log.
}
