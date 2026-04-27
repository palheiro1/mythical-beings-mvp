import React, { useState, useEffect } from 'react';
import { PLAYHUB_SEASON_ID, supabase } from '../utils/supabase.js';

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

  return (
    <div className="min-h-screen bg-gray-900 text-white pt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center mb-4">
          <img src="/images/banner.png" alt="Mythical Beings" className="w-full max-w-xl h-auto rounded-lg shadow-lg object-contain max-h-40 sm:max-h-48 md:max-h-56 lg:max-h-64" />
        </div>
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
          Leaderboard
        </h1>

        {loading && <p className="text-center text-gray-400">Loading leaderboard...</p>}
        {error && <p className="text-center text-red-500">Error: {error}</p>}

        {!loading && !error && (
          <div className="bg-gray-800 bg-opacity-70 rounded-xl shadow-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700 bg-opacity-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-16">Rank</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Player</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Points</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Wins</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Games Played</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Best Score</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {leaderboardData.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-200 text-center">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <img
                            width={32}
                            height={32}
                            className="h-10 w-10 rounded-full object-cover border border-gray-600"
                            src={entry.avatar_url || `/api/placeholder-avatar?text=${entry.username?.charAt(0).toUpperCase() || '?'}`}
                            alt={entry.username || 'User Avatar'}
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-100">{entry.username || `User (${entry.id.substring(0, 6)})`}</div>
                          {/* Optional: Add user ID or other info */}
                          {/* <div className="text-xs text-gray-400">{entry.id}</div> */}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{entry.points}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{entry.wins}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{entry.games_played}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{entry.best_score}</td>
                  </tr>
                ))}
                {leaderboardData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400">No players found on the leaderboard yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
