import '../../src/index.css';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import {
  projectMatch,
  advanceMatch,
  COMMAND_PROTOCOL_V2,
  type CompetitiveSnapshot,
} from '@mythicalb/wisdom-duel-engine';
import ChallengeArena from '../../src/components/competition/ChallengeArena.js';
import { scenarios, effectScenario, resolveScenario, type Scenario } from './duelEffectScenarios.js';

const initial = await effectScenario('Earthquake');
// A setup can stay open for review. Start its competitive clock on the first move.
function startScenarioClock(match: CompetitiveSnapshot, now: string) {
  return match.version === 0 ? { ...match, clock: { ...match.clock, updatedAt: now } } : match;
}

export default function Demo() {
  const [name, setName] = useState<Scenario>('Earthquake');
  const [snapshot, setSnapshot] = useState(initial);
  const [key, setKey] = useState(0);
  const [viewer, setViewer] = useState('north');
  async function reset(next: Scenario) {
    const match = await effectScenario(next);
    setName(next);
    setSnapshot(match);
    setKey((k) => k + 1);
  }
  function show() {
    const now = new Date().toISOString();
    setSnapshot((s) => (s.version === 0 ? resolveScenario(name, startScenarioClock(s, now), now) : s));
  }
  const now = new Date().toISOString();
  const projection = projectMatch(startScenarioClock(snapshot, now), viewer, now);
  if (snapshot.version === 0) projection.clock.runningPlayerId = null;
  return (
    <>
      <nav
        className="wd"
        aria-label="Effect scenarios"
        style={{ padding: '6px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <label>
          Card{' '}
          <select value={name} onChange={(e) => void reset(e.target.value as Scenario)}>
            {scenarios.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button className="wd-button" onClick={snapshot.version ? () => void reset(name) : show}>
          {snapshot.version ? 'Reset setup' : 'Resolve effect'}
        </button>
        <label>
          View{' '}
          <select value={viewer} onChange={(e) => setViewer(e.target.value)}>
            <option value="north">Attacker</option>
            <option value="south">Defender</option>
          </select>
        </label>
      </nav>
      <ChallengeArena
        key={`${key}-${viewer}`}
        projection={projection}
        playerId={viewer}
        lobbyPath="/"
        sending={false}
        retryable={false}
        error=""
        send={async (command) => {
          if (!command) return;
          const now = new Date().toISOString();
          const next: CompetitiveSnapshot = advanceMatch(
            startScenarioClock(snapshot, now),
            viewer,
            {
              matchId: snapshot.state.gameId,
              expectedVersion: snapshot.version,
              commandId: crypto.randomUUID(),
              protocolVersion: COMMAND_PROTOCOL_V2,
              command,
            },
            now,
          );
          setSnapshot(next);
          return 'accepted';
        }}
      />
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <Demo />
  </MemoryRouter>,
);
