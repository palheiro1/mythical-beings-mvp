import { createObservationClient, readJourney } from './observationClient.js';
import { OBSERVATION_ENDPOINT, OBSERVATION_PUBLIC_KEY } from './observationConfig.js';
import type { GameState } from '../game/types.js';

const client = createObservationClient({product:'wisdom_duel',mode:'training',
  endpoint: import.meta.env.VITE_OBSERVATIONS_ENABLED === 'false' ? undefined : OBSERVATION_ENDPOINT,
  publicKey: OBSERVATION_PUBLIC_KEY,
  population: import.meta.env.MODE === 'test' || import.meta.env.VITE_OBSERVATIONS_TEST === 'true' ? 'technical_test' : 'public'});
const journey = readJourney();
export const observeGameOpen = () => client.emit('game_open', journey, 'page');
export function observeTraining(previous: GameState | null, current: GameState) {
  client.emit('training_start', journey, current.gameId);
  if (previous?.gameId === current.gameId && previous.currentPlayerIndex === 0 &&
      (current.actionsTakenThisTurn > previous.actionsTakenThisTurn ||
       current.log.slice(previous.log.length).some(line => line.startsWith('[Action]')))) {
    client.emit('first_action', journey, current.gameId);
  }
  if (current.phase === 'gameOver') client.emit('training_complete', journey, current.gameId);
}
