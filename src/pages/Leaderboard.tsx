import React, { useMemo, useState, useEffect } from 'react';
import { ArrowDownUp, Medal, Trophy } from 'lucide-react';
import { PLAYHUB_SEASON_ID, supabase } from '../utils/supabase.js';
import { ArenaButton, EmptyState, PageShell, Panel, Skeleton, StatusBadge } from '../components/ui/index.js';

interface LeaderboardEntry {
  id: string;
  username: string | null;
  avatar_url: string | null;
  points: number;
  wins: number;
  games_played: number;
  best_score: number;
}

const Leaderboard: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'points' | 'wins' | 'games_played' | 'best_score'>('points');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('leaderboard_entries')
          .select('player_id, points, wins, games_played, best_score, updated_at, profiles(display_name, avatar_url)')
          .eq('season_id', PLAYHUB_SEASON_ID)
          .order('points', { ascending: false })
          .order('wins', { ascending: false })
          .order('best_score', { ascending: false })
          .order('updated_at', { ascending: true })
          .limit(100);

        if (fetchError) {
          throw fetchError;
        }

        const processedData = (data ?? []).map((entry: any) => {
          const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
          return {
            id: entry.player_id,
            username: profile?.display_name ?? `User (${entry.player_id.substring(0, 6)})`,
            avatar_url: profile?.avatar_url ?? null,
            points: entry.points ?? 0,
            wins: entry.wins ?? 0,
          games_played: entry.games_played ?? 0,
            best_score: entry.best_score ?? 0,
          };
        });

        setLeaderboardData(processedData);

      } catch (err) {
        console.error('[Leaderboard] Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const sortedData = useMemo(() => {
    return [...leaderboardData].sort((a, b) => {
      const diff = (b[sortKey] ?? 0) - (a[sortKey] ?? 0);
      if (diff !== 0) return diff;
      return b.wins - a.wins || b.best_score - a.best_score;
    });
  }, [leaderboardData, sortKey]);

  const topThree = sortedData.slice(0, 3);
  const formatNumber = (value: number) => new Intl.NumberFormat().format(value);
  const sortButton = (key: typeof sortKey, label: string) => (
    <button type="button" onClick={() => setSortKey(key)} className="inline-flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white">
      {label}
      <ArrowDownUp className={`h-3.5 w-3.5 ${sortKey === key ? 'text-amber-200' : 'text-slate-500'}`} aria-hidden />
    </button>
  );

  return (
    <PageShell contentClassName="space-y-6 pb-24">
      <Panel className="arena-banner-center p-6 text-center sm:p-8" glow>
        <StatusBadge tone="amber" className="mb-4">
          <Trophy className="h-3.5 w-3.5" aria-hidden />
          Season Ranking
        </StatusBadge>
        <h1 className="font-display text-5xl font-black uppercase text-slate-50">Leaderboard</h1>
        <p className="mt-3 text-slate-300">Compete against the best. Climb the ranks and earn glory.</p>
      </Panel>

      {loading && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-44" />
            <Skeleton className="h-36" />
          </div>
          <Skeleton className="h-96" />
        </div>
      )}

      {error && !loading && (
        <Panel className="p-6 text-center">
          <StatusBadge tone="red">Could not load leaderboard</StatusBadge>
          <p className="mt-3 text-slate-300">{error}</p>
          <ArenaButton type="button" className="mt-5" variant="secondary" onClick={() => window.location.reload()}>Retry</ArenaButton>
        </Panel>
      )}

      {!loading && !error && sortedData.length === 0 && (
        <EmptyState title="No players found on the leaderboard yet." description="Play a PvP match to start building the ranking." />
      )}

      {!loading && !error && sortedData.length > 0 && (
        <>
          <div className="grid items-end gap-4 md:grid-cols-3">
            {topThree.map((entry, index) => (
              <Panel key={entry.id} className={`p-5 text-center ${index === 0 ? 'md:order-2 md:scale-105' : index === 1 ? 'md:order-1' : 'md:order-3'}`} glow={index === 0}>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-amber-300/40 bg-amber-500/10">
                  <Medal className={`h-7 w-7 ${index === 0 ? 'text-amber-200' : index === 1 ? 'text-slate-200' : 'text-orange-300'}`} aria-hidden />
                </div>
                <img
                  width={64}
                  height={64}
                  className="mx-auto mt-4 h-16 w-16 rounded-full border border-white/15 object-cover"
                  src={entry.avatar_url || `/api/placeholder-avatar?text=${entry.username?.charAt(0).toUpperCase() || '?'}`}
                  alt={entry.username || 'User Avatar'}
                />
                <p className="mt-3 text-sm uppercase tracking-widest text-slate-500">Rank {index + 1}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-100">{entry.username || `User (${entry.id.substring(0, 6)})`}</h2>
                <p className="mt-2 text-3xl font-black text-amber-200">{formatNumber(entry.points)}</p>
                <p className="text-xs uppercase tracking-widest text-slate-500">Points</p>
              </Panel>
            ))}
          </div>

          <Panel className="overflow-hidden">
            <div className="arena-scrollbar overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/[0.04]">
                  <tr>
                    <th scope="col" className="w-16 px-4 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-400">Rank</th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-400">Player</th>
                    <th scope="col" className="px-6 py-4 text-center">{sortButton('points', 'Points')}</th>
                    <th scope="col" className="px-6 py-4 text-center">{sortButton('wins', 'Wins')}</th>
                    <th scope="col" className="px-6 py-4 text-center">{sortButton('games_played', 'Games Played')}</th>
                    <th scope="col" className="px-6 py-4 text-center">{sortButton('best_score', 'Best Score')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sortedData.map((entry, index) => (
                    <tr key={entry.id} className="transition hover:bg-white/[0.04]">
                      <td className="whitespace-nowrap px-4 py-4 text-center text-sm font-black text-slate-200">{index + 1}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center">
                          <img
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full border border-white/15 object-cover"
                            src={entry.avatar_url || `/api/placeholder-avatar?text=${entry.username?.charAt(0).toUpperCase() || '?'}`}
                            alt={entry.username || 'User Avatar'}
                          />
                          <div className="ml-4">
                            <div className="text-sm font-bold text-slate-100">{entry.username || `User (${entry.id.substring(0, 6)})`}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm font-bold text-violet-200">{formatNumber(entry.points)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-slate-300">{formatNumber(entry.wins)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-slate-300">{formatNumber(entry.games_played)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-slate-300">{formatNumber(entry.best_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </PageShell>
  );
};

export default Leaderboard;
