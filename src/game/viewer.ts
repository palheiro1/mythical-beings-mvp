import type { GameState, PlayerState } from './types.js';

export type ViewerPlayerIndex = 0 | 1 | -1;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getViewerPlayerIndex = (
  state: Pick<GameState, 'players'> | null | undefined,
  viewerId: string | null | undefined,
): ViewerPlayerIndex => {
  if (!state || !viewerId || state.players.length < 2) return -1;
  if (state.players[0]?.id === viewerId) return 0;
  if (state.players[1]?.id === viewerId) return 1;
  return -1;
};

export const isViewerTurn = (
  state: Pick<GameState, 'players' | 'currentPlayerIndex' | 'winner'> | null | undefined,
  viewerId: string | null | undefined,
): boolean => {
  const playerIndex = getViewerPlayerIndex(state, viewerId);
  return playerIndex !== -1
    && state?.currentPlayerIndex === playerIndex
    && state.winner === null;
};

export interface PlayerPowerSnapshot {
  p0: number;
  p1: number;
}

export interface DetectedPowerDamage {
  playerIndex: 0 | 1;
  damage: number;
  blocked?: number;
  bypass?: boolean;
}

export const parseRecentDefenseFromLogs = (
  logs: readonly string[],
  targetId: string | null | undefined,
): { blocked?: number; bypass?: boolean } => {
  if (!targetId) return {};
  for (let index = logs.length - 1; index >= Math.max(0, logs.length - 10); index -= 1) {
    const line = logs[index];
    if (!line || !line.includes('deals') || !line.includes(targetId)) continue;
    const defenseMatch = line.match(/Defense:\s*(\d+)/i);
    const blocked = defenseMatch ? Number.parseInt(defenseMatch[1], 10) : undefined;
    return {
      ...(blocked !== undefined && Number.isSafeInteger(blocked) ? { blocked } : {}),
      ...(/bypass(ed)?/i.test(line) ? { bypass: true } : {}),
    };
  }
  return {};
};

export const detectPowerDamage = (
  previous: PlayerPowerSnapshot | null,
  current: PlayerPowerSnapshot,
  playerIds: readonly [string | undefined, string | undefined],
  logs: readonly string[],
): DetectedPowerDamage | null => {
  if (!previous) return null;
  const playerIndex = current.p0 < previous.p0
    ? 0
    : current.p1 < previous.p1
      ? 1
      : null;
  if (playerIndex === null) return null;
  const damage = playerIndex === 0
    ? previous.p0 - current.p0
    : previous.p1 - current.p1;
  return {
    playerIndex,
    damage,
    ...parseRecentDefenseFromLogs(logs, playerIds[playerIndex]),
  };
};

export interface FieldKnowledgeSnapshot {
  mine: string[];
  opponent: string[];
  images: Record<string, string>;
}

export interface RemovedFieldKnowledge {
  instanceId: string;
  image?: string;
}

export const createFieldKnowledgeSnapshot = (
  players: readonly PlayerState[],
  viewerPlayerIndex: 0 | 1,
): FieldKnowledgeSnapshot => {
  const opponentIndex = viewerPlayerIndex === 0 ? 1 : 0;
  const instanceIds = (player: PlayerState | undefined) => (
    player?.field
      .map((slot) => slot.knowledge?.instanceId)
      .filter((instanceId): instanceId is string => Boolean(instanceId))
    ?? []
  );
  const images: Record<string, string> = {};
  for (const player of players) {
    for (const slot of player.field) {
      if (slot.knowledge?.instanceId) images[slot.knowledge.instanceId] = slot.knowledge.image;
    }
  }
  return {
    mine: instanceIds(players[viewerPlayerIndex]),
    opponent: instanceIds(players[opponentIndex]),
    images,
  };
};

export const findRemovedFieldKnowledge = (
  previous: FieldKnowledgeSnapshot | null,
  current: FieldKnowledgeSnapshot,
): RemovedFieldKnowledge | null => {
  if (!previous) return null;
  const removed = previous.mine.find((instanceId) => !current.mine.includes(instanceId))
    ?? previous.opponent.find((instanceId) => !current.opponent.includes(instanceId));
  if (!removed) return null;
  return {
    instanceId: removed,
    image: previous.images[removed] ?? current.images[removed],
  };
};

export interface ParsedDamageLog {
  amount: number;
  targetPlayerId: string;
}

export interface AttackMoveSource {
  attackerInstanceId: string;
  image: string;
  targetPlayerIndex: 0 | 1;
}

export const parseDamageLogLine = (line: string | null | undefined): ParsedDamageLog | null => {
  if (!line) return null;
  const match = line.match(/deals\s+(\d+)\s+damage\s+to\s+([0-9a-f-]{36})/i);
  if (!match || !UUID_PATTERN.test(match[2])) return null;
  const amount = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(amount) || amount < 1) return null;
  return { amount, targetPlayerId: match[2] };
};

export const findAttackMoveSource = (
  line: string | null | undefined,
  players: readonly PlayerState[],
): AttackMoveSource | null => {
  const damage = parseDamageLogLine(line);
  if (!damage || players.length < 2) return null;
  const targetPlayerIndex = players[0]?.id === damage.targetPlayerId
    ? 0
    : players[1]?.id === damage.targetPlayerId
      ? 1
      : null;
  if (targetPlayerIndex === null) return null;
  const attacker = players[targetPlayerIndex === 0 ? 1 : 0]?.field
    .find((slot) => Boolean(slot.knowledge?.instanceId))
    ?.knowledge;
  if (!attacker?.instanceId) return null;
  return {
    attackerInstanceId: attacker.instanceId,
    image: attacker.image,
    targetPlayerIndex,
  };
};
