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
  summons: 'summon',
  takes: 'take',
  uses: 'use',
  wins: 'win',
};

export const formatGameHistoryEntry = (
  log: string,
  playerLabels: Record<string, string> = {},
) => {
  let formatted = log
    .replace(/^\[[^\]]+\]\s*/, '')
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
    /\bYou (absorbs|deals|discards|draws|ends|gains|has|is|loses|receives|rotates|selects|starts|summons|takes|uses|wins)\b/g,
    (_match, verb: string) => `You ${YOU_VERB_FORMS[verb]}`,
  );
};
