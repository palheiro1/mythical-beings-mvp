import { LinkedWallet } from '@mythicalb/sdk';
import { mythical } from './mythicalClient.js';

function isLinkedPolygonWallet(wallet: unknown): wallet is LinkedWallet {
  return Boolean(
    wallet
      && typeof wallet === 'object'
      && !Array.isArray(wallet)
      && (wallet as LinkedWallet).chain === 'polygon'
      && typeof (wallet as LinkedWallet).address === 'string',
  );
}

export async function getLinkedPolygonWallet(): Promise<LinkedWallet | null> {
  const wallet = await mythical.wallets.getStatus('polygon');
  return isLinkedPolygonWallet(wallet) ? wallet : null;
}

export async function connectLinkedPolygonWallet(): Promise<LinkedWallet> {
  return mythical.wallets.connect('polygon');
}
