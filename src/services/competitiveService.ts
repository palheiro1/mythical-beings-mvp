import { createWisdomDuelClient } from '@mythicalb/sdk/wisdom-duel';
import type { WisdomWalletConfig } from '@mythicalb/sdk/wisdom-duel-wallet';
import { mythical } from './mythicalClient.js';
import {
  CARDS_CONTRACT,
  GEM_CONTRACT,
  POLYGON_CHAIN_ID,
  POLYGON_RPC_URL,
  getPolygonProvider,
} from '../config/playhub.js';

export const competitive = createWisdomDuelClient(mythical.supabase);
export type {
  WisdomMatchView,
  WisdomMatchResponse,
  WisdomQueueState,
  WisdomSeason,
  WisdomLeagueResponse,
} from '@mythicalb/sdk/wisdom-duel';
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
    admission_closed: 'As novas entradas estão temporariamente fechadas.',
    season_unavailable: 'Esta temporada ainda não está aberta ou já fechou a fila.',
    queue_cooldown: 'Aguarda cinco minutos antes de voltar à fila.',
    already_active: 'Já tens uma entrada ou partida ativa.',
    persistent_account_required: 'Entra com uma conta permanente do Play Hub.',
    selection_immutable: 'A equipa já foi confirmada e não pode mudar.',
    selection_unavailable: 'O prazo de seleção terminou.',
    rule_violation: 'Esta jogada não é permitida no estado atual. Podes escolher outra ação.',
    suspended: 'A partida está suspensa para revisão técnica. O tempo está preservado.',
    version_conflict: 'O tabuleiro mudou. Escolhe a jogada a partir do estado atualizado.',
    five_creatures_required:
      'Precisas de cinco criaturas elegíveis diferentes para um duelo com aposta. Podes continuar na liga gratuita.',
    insufficient_gem: 'O saldo GEM não chega para esta aposta.',
    verified_wallet_required: 'Associa e verifica a carteira Polygon antes de continuar.',
    both_selections_required: 'Aguarda que os dois jogadores confirmem as equipas.',
    finality_unavailable: 'A confirmação final da rede está indisponível. A operação continua pendente.',
    admin_required: 'Esta conta não tem acesso à administração.',
    review_incomplete: 'A revisão ainda não terminou ou há reclamações por resolver.',
    connection_failed: 'A ligação ao servidor falhou. Tenta novamente.',
    match_not_playable: 'A partida terminou ou ainda não está pronta.',
    distribution_locked: 'A distribuição já foi aprovada e está fechada a alterações.',
    review_window_closed: 'A janela de reclamações já terminou.',
  };
  return (
    messages[code] ??
    (error instanceof Error && !code
      ? error.message
      : 'Não foi possível concluir o pedido. Atualiza e tenta novamente.')
  );
}
export const localDate = (value: string) => new Date(value).toLocaleString();
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
