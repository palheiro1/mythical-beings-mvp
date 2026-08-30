import type {
  Creature,
  GameState,
  Knowledge,
  PendingEffect,
  PendingEffectChoice,
} from './types.js';

export type ProjectionViewer =
  | { kind: 'player'; playerId: string }
  | { kind: 'spectator' };

export type ProjectedHand =
  | { visibility: 'visible'; count: number; cards: Knowledge[] }
  | { visibility: 'hidden'; count: number };

export interface ProjectedPlayerState {
  id: string;
  power: number;
  creatures: Creature[];
  field: { creatureId: string; knowledge: Knowledge | null }[];
  hand: ProjectedHand;
}

export interface ProjectedPendingChoice {
  key: string;
  kind: PendingEffectChoice['kind'];
  label: string;
  image?: string;
  creatureId?: string;
}

export interface ProjectedPendingEffect {
  id: string;
  type: PendingEffect['type'];
  prompt: string;
  optional: boolean;
  choices: ProjectedPendingChoice[];
}

export interface GameProjection {
  protocol: 'wisdom-duel-projection-v1';
  matchId: string;
  stateVersion: number;
  eventSequence: number;
  rulesVersion: 'rulebook-v1';
  turn: number;
  phase: GameState['phase'];
  currentPlayerId: string;
  actionsTakenThisTurn: number;
  actionsPerTurn: number;
  winner: string | null;
  players: [ProjectedPlayerState, ProjectedPlayerState];
  market: Knowledge[];
  discardPile: Knowledge[];
  deckCount: number;
  pendingEffect: ProjectedPendingEffect | null;
  log: string[];
  seedCommitment?: string;
  turnDeadline?: string;
}

export interface ProjectionMetadata {
  stateVersion: number;
  eventSequence: number;
  seedCommitment?: string;
  turnDeadline?: string;
}

export function pendingChoiceKey(index: number): string {
  return `choice-${index + 1}`;
}

export function resolvePendingChoiceByKey(
  pendingEffect: PendingEffect,
  choiceKey: string,
): PendingEffectChoice | undefined {
  const match = /^choice-([1-9][0-9]*)$/.exec(choiceKey);
  if (!match) return undefined;
  const index = Number(match[1]) - 1;
  return pendingEffect.choices[index];
}

function projectPendingChoice(
  choice: PendingEffectChoice,
  index: number,
  viewerPlayerIndex: number,
): ProjectedPendingChoice {
  const base: ProjectedPendingChoice = {
    key: pendingChoiceKey(index),
    kind: choice.kind,
    label: choice.label,
  };

  if (choice.kind === 'hand' && choice.playerIndex !== viewerPlayerIndex) {
    return {
      ...base,
      label: `Hidden card ${index + 1}`,
    };
  }
  if ('image' in choice && choice.image) base.image = choice.image;
  if ('creatureId' in choice) base.creatureId = choice.creatureId;
  return base;
}

function projectPendingEffect(state: GameState, viewer: ProjectionViewer): ProjectedPendingEffect | null {
  const pending = state.pendingEffect;
  if (!pending || viewer.kind !== 'player' || viewer.playerId !== pending.playerId) return null;
  const viewerPlayerIndex = state.players.findIndex((player) => player.id === viewer.playerId);
  if (viewerPlayerIndex === -1) return null;

  return {
    id: pending.id,
    type: pending.type,
    prompt: pending.prompt,
    optional: pending.optional === true,
    choices: pending.choices.map((choice, index) => projectPendingChoice(choice, index, viewerPlayerIndex)),
  };
}

export function buildGameProjection(
  state: GameState,
  viewer: ProjectionViewer,
  metadata: ProjectionMetadata,
): GameProjection {
  const players = state.players.map((player): ProjectedPlayerState => {
    const seesHand = viewer.kind === 'player' && viewer.playerId === player.id;
    return {
      id: player.id,
      power: player.power,
      creatures: structuredClone(player.creatures),
      field: structuredClone(player.field),
      hand: seesHand
        ? { visibility: 'visible', count: player.hand.length, cards: structuredClone(player.hand) }
        : { visibility: 'hidden', count: player.hand.length },
    };
  }) as [ProjectedPlayerState, ProjectedPlayerState];

  const projection: GameProjection = {
    protocol: 'wisdom-duel-projection-v1',
    matchId: state.gameId,
    stateVersion: metadata.stateVersion,
    eventSequence: metadata.eventSequence,
    rulesVersion: 'rulebook-v1',
    turn: state.turn,
    phase: state.phase,
    currentPlayerId: state.players[state.currentPlayerIndex].id,
    actionsTakenThisTurn: state.actionsTakenThisTurn,
    actionsPerTurn: state.actionsPerTurn,
    winner: state.winner,
    players,
    market: structuredClone(state.market),
    discardPile: structuredClone(state.discardPile),
    deckCount: state.knowledgeDeck.length,
    pendingEffect: projectPendingEffect(state, viewer),
    log: [...state.log],
  };
  if (metadata.seedCommitment) projection.seedCommitment = metadata.seedCommitment;
  if (metadata.turnDeadline) projection.turnDeadline = metadata.turnDeadline;
  return projection;
}
