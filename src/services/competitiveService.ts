import { createWisdomDuelClient } from '@mythicalb/sdk/wisdom-duel';
import { FunctionRegion } from '@supabase/supabase-js';
import type { WisdomWalletConfig } from '@mythicalb/sdk/wisdom-duel-wallet';
import { mythical } from './mythicalClient.js';
import {
  CARDS_CONTRACT,
  GEM_CONTRACT,
  POLYGON_CHAIN_ID,
  POLYGON_RPC_URL,
  getPolygonProvider,
} from '../config/playhub.js';

export const competitive = createWisdomDuelClient(mythical.supabase, { region: FunctionRegion.EuWest1 });
export type {
  WisdomMatchView,
  WisdomMatchResponse,
  WisdomQueueState,
  WisdomSeason,
  WisdomLeagueResponse,
} from '@mythicalb/sdk/wisdom-duel';
export interface WisdomChallengeResponse {
  periods: Array<{
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    queueClosesAt: string;
    admissionOpen: boolean;
  }>;
  periodId: string | null;
  standings: Array<{ position: number; playerName: string; rating: string; games: number; isMe: boolean }>;
  myResults: Array<{ matchId: string; finishedAt: string; outcome: 'win' | 'loss' | 'draw'; ranked: boolean }>;
}

export function challengeStandings(challengeId?: string, offset = 0) {
  return competitive.invoke<WisdomChallengeResponse>('league', { action: 'challenge_list', challengeId, offset });
}

export function competitiveWalletConfig(requireEscrow = true): WisdomWalletConfig {
  const escrow = String(import.meta.env.VITE_WISDOM_DUEL_ESCROW_V2_ADDRESS ?? '').trim()
    || (requireEscrow ? '' : '0x0000000000000000000000000000000000000000');
  if (!/^0x[0-9a-f]{40}$/i.test(escrow) || !POLYGON_RPC_URL)
    throw new Error('A ligação à carteira competitiva ainda não está configurada.');
  return {
    provider: getPolygonProvider() as unknown as WisdomWalletConfig['provider'],
    rpcUrl: POLYGON_RPC_URL,
    chainId: POLYGON_CHAIN_ID,
    escrowAddress: escrow as `0x${string}`,
    gemAddress: GEM_CONTRACT as `0x${string}`,
    cardsAddress: CARDS_CONTRACT as `0x${string}`,
  };
}
export function competitiveError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    admission_closed: 'The queue is temporarily closed.',
    challenge_unavailable: 'The queue is closed for this edition.',
    season_unavailable: 'Esta temporada ainda não está aberta ou já fechou a fila.',
    queue_cooldown: 'Wait five minutes before joining the queue again.',
    already_active: 'You are already in the queue or in a duel.',
    persistent_account_required: 'Sign in with a permanent Play Hub account.',
    selection_immutable: 'You have already confirmed your team.',
    selection_unavailable: 'The team selection timer has expired.',
    rule_violation: 'That move is unavailable. Choose another action.',
    suspended: 'The duel is under review. Both clocks are paused.',
    version_conflict: 'The board has changed. Choose your move again.',
    five_creatures_required:
      'Precisas de cinco criaturas elegíveis diferentes para um duelo com aposta. Podes continuar na liga gratuita.',
    insufficient_gem: 'O saldo GEM não chega para esta aposta.',
    verified_wallet_required: 'Associa e verifica a carteira Polygon antes de continuar.',
    both_selections_required: 'Waiting for both players to confirm their teams.',
    finality_unavailable: 'A confirmação final da rede está indisponível. A operação continua pendente.',
    admin_required: 'Esta conta não tem acesso à administração.',
    review_incomplete: 'A revisão ainda não terminou ou há reclamações por resolver.',
    transaction_submitted: 'A transação foi enviada. Atualiza a verificação; não voltes a enviá-la.',
    wallet_changed: 'A conta da carteira mudou. Seleciona novamente a conta associada à partida.',
    wrong_chain: 'Seleciona a rede Polygon na carteira.',
    authorization_expired: 'A autorização expirou. Atualiza a operação para obter uma nova.',
    connection_failed: 'Could not reach the server. Try again.',
    match_not_playable: 'The duel is over or has not started yet.',
    distribution_locked: 'A distribuição já foi aprovada e está fechada a alterações.',
    review_window_closed: 'A janela de reclamações já terminou.',
  };
  return (
    messages[code] ??
    (error instanceof Error && !code
      ? error.message
      : 'Could not complete the request. Refresh and try again.')
  );
}
export const localDate = (value: string, locale?: string) => new Date(value).toLocaleString(locale);
export function formatGem(atomic: string, decimals = 18): string {
  const amount = BigInt(atomic),
    scale = 10n ** BigInt(decimals),
    fraction = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${amount / scale}${fraction ? ',' + fraction : ''}`;
}
export function parseGem(input: string, decimals = 18): string {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error('Indica um montante GEM positivo.');
  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > decimals) throw new Error('O montante tem casas decimais a mais.');
  const value = BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction || '0').padEnd(decimals, '0'));
  if (value <= 0n) throw new Error('Indica um montante GEM positivo.');
  return value.toString();
}
