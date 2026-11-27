import { getDisplayCardById } from './cardCatalog.js';
import type { PublicMatchEvent } from '@mythicalb/wisdom-duel-engine/competitive';

const matchEventLabels: Record<PublicMatchEvent['type'], string> = {
  draw_knowledge: 'Draw from the Market',
  rotate_creature: 'Rotate a Creature',
  summon_knowledge: 'Play a Knowledge card',
  rotate_knowledge: 'Rotate a Knowledge card',
  resolve_pending_effect: 'Resolve effect',
  end_turn: 'End Turn',
  resign: 'Concede',
  turn_timeout: 'Turn expired',
  timeout: 'Time expired',
  suspend: 'Pause match',
  resume: 'Resume match',
};

export const formatMatchEvent = (type?: PublicMatchEvent['type']) => type ? matchEventLabels[type] : 'Start';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const YOU_VERB_FORMS: Record<string, string> = {
  absorbs: 'absorb',
  deals: 'deal',
  discards: 'discard',
  draws: 'draw',
  ends: 'end',
  gains: 'gain',
  has: 'have',
  is: 'are',
  loses: 'lose',
  receives: 'receive',
  rotates: 'rotate',
  selects: 'select',
  starts: 'start',
  plays: 'play',
  summons: 'play',
  takes: 'take',
  uses: 'use',
  wins: 'win',
};

export const formatGameHistoryEntry = (
  log: string,
  playerLabels: Record<string, string> = {},
) => {
  let formatted = log
    .replace(/^\[(?:Apparition|Appearance|On play)\]\s*/i, 'On play · ')
    .replace(/^\[(?:Final|On final rotation)\]\s*/i, 'On final rotation · ')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^(.+) summoned (.+) onto (.+)\.$/, (_, actor, card, target) =>
      `${actor} played ${card} on ${getDisplayCardById(target)?.name ?? target}.`)
    .replace(/^(.+) replaced (.+) with (.+) onto (.+)\.$/, (_, actor, previous, card, target) =>
      `${actor} played ${card} on ${getDisplayCardById(target)?.name ?? target}, replacing ${previous}.`)
    .replace(/\b(summons|summon) (.+) onto (.+)\.$/, (_, verb, card, target) =>
      `${verb === 'summons' ? 'plays' : 'play'} ${card} on ${getDisplayCardById(target)?.name ?? target}.`)
    .replace(/\bDudugera allows summoning (.+) onto itself without spending an action\./, 'Playing $1 on Dudugera uses no action.')
    .replace(/\bKappa allows summoning aquatic knowledge (.+) without spending an action\./, 'Kappa lets you play $1 without spending an action.')
    .replace(/^Game \S+ initialized\./, 'Game initialized.');

  const [firstPlayerLabel, secondPlayerLabel] = Object.values(playerLabels);
  if (firstPlayerLabel) formatted = formatted.replace(/\bPlayer 1\b/g, firstPlayerLabel);
  if (secondPlayerLabel) formatted = formatted.replace(/\bPlayer 2\b/g, secondPlayerLabel);

  Object.entries(playerLabels)
    .sort(([left], [right]) => right.length - left.length)
    .forEach(([playerId, label]) => {
      if (!playerId || !label) return;
      const playerPattern = new RegExp(
        `(^|[^\\w-])${escapeRegExp(playerId)}([^\\w-]|$)`,
        'g',
      );
      formatted = formatted.replace(
        playerPattern,
        (_match, before: string, after: string) => `${before}${label}${after}`,
      );
    });

  formatted = formatted
    .replace(/Player You\b/g, 'You')
    .replace(/Player Bot\b/g, 'Bot');

  return formatted.replace(
    /\bYou (absorbs|deals|discards|draws|ends|gains|has|is|loses|receives|rotates|selects|starts|plays|summons|takes|uses|wins)\b/g,
    (_match, verb: string) => `You ${YOU_VERB_FORMS[verb]}`,
  );
};
