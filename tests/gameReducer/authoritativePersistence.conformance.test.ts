import { TransactionalInMemoryAuthoritativeStore } from '../../src/game/authoritativePersistence.js';
import {
  runAuthoritativePersistenceConformanceContract,
  type AuthoritativePersistenceConformanceHarness,
} from '../contracts/authoritativePersistenceContract.js';

runAuthoritativePersistenceConformanceContract('transactional in-memory reference', async () => {
  const store = new TransactionalInMemoryAuthoritativeStore();
  const harness: AuthoritativePersistenceConformanceHarness = {
    persistence: store,
    seedMatch: async (state) => { store.registerMatch(state); },
    readPrivateMatch: async (matchId) => store.readPrivateMatchForTest(matchId),
    readEvents: async (matchId) => store.readEventsForTest(matchId),
    injectCommitFailure: async (mode) => { store.failNextCommit(mode); },
    dispose: async () => undefined,
  };
  return harness;
});

