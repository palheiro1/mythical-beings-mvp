import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArenaButton, Input, PageShell, Panel } from '../components/ui/index.js';
import { useAuth } from '../hooks/useAuth.js';
import { competitive, competitiveError } from '../services/competitiveService.js';
export default function WagerLobby() {
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    { polygonWallet, connectPolygonWallet } = useAuth();
  const [stake, setStake] = useState(''),
    [room, setRoom] = useState(params.get('join') ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const act = async (join: boolean) => {
    setBusy(true);
    setError('');
    try {
      const match = join ? await competitive.joinWager(room.trim()) : await competitive.createWager(stake);
      navigate(`/duel/${match.matchId}`);
    } catch (e) {
      setError(competitiveError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageShell contentClassName="max-w-3xl space-y-6">
      <Link className="text-cyan-200" to="/competition">
        ← Modos de jogo
      </Link>
      <h1 className="text-4xl font-bold">Duelos com aposta</h1>
      <p>
        Cada carteira oferece cinco criaturas de toda a coleção elegível. Escolhe três. O vencedor recebe os dois depósitos GEM e uma carta utilizada pelo derrotado.
      </p>
      <p>
        A aposta não altera o Elo nem os prémios da liga. Precisas de cinco criaturas diferentes. Perder a
        última cópia de uma carta pode impedir outro duelo, mas a liga gratuita continua acessível.
      </p>
      {!polygonWallet ? (
        <ArenaButton onClick={() => void connectPolygonWallet().catch((e) => setError(competitiveError(e)))}>
          Associar carteira Polygon
        </ArenaButton>
      ) : null}
      <Panel className="space-y-4 p-6">
        <h2 className="text-xl font-bold">Criar uma sala</h2>
        <label className="block">
            Aposta de cada jogador em GEM
            <Input
              className="mt-2"
              inputMode="numeric"
              value={stake}
              onChange={(e) => setStake(e.target.value.replace(/\D/g, ''))}
              placeholder="Montante inteiro"
            />
        </label>
        <ArenaButton
          loading={busy}
          disabled={!polygonWallet || !stake}
          onClick={() => void act(false)}
        >
          Criar convite
        </ArenaButton>
      </Panel>
      <Panel className="space-y-4 p-6">
        <h2 className="text-xl font-bold">Entrar por convite</h2>
        <label className="block">
          Código da sala
          <Input className="mt-2" value={room} onChange={(e) => setRoom(e.target.value)} />
        </label>
        <ArenaButton
          loading={busy}
          disabled={!room || !polygonWallet}
          onClick={() => void act(true)}
        >
          Entrar na sala
        </ArenaButton>
      </Panel>
      {error ? (
        <p role="alert" className="text-red-200">
          {error}
        </p>
      ) : null}
    </PageShell>
  );
}
