import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase.js'; // Assuming supabase client is exported

interface LeaderboardEntry {
  id: string;
  username: string | null;
  avatar_url: string | null;
  games_won: number;
  games_played: number;
  earned_gem?: number | null;
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
        // Fetch profiles, ensuring games_won and games_played are selected
        // Order by games_won descending, then games_played ascending as a tie-breaker
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, games_won, games_played, earned_gem')
          .order('games_won', { ascending: false })
          .order('games_played', { ascending: true }) // Optional tie-breaker
          .limit(100); // Limit results if needed

        if (fetchError) {
          throw fetchError;
        }

        // Ensure games_won and games_played are numbers, default to 0 if null/undefined
  const processedData = data.map((entry: any) => ({
          ...entry,
          games_won: entry.games_won ?? 0,
          games_played: entry.games_played ?? 0,
          earned_gem: entry.earned_gem ?? 0,
        }));

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
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Games Won</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Games Played</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Earned GEM</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{entry.games_won}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{entry.games_played}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{Number(entry.earned_gem || 0)}</td>
                  </tr>
                ))}
                {leaderboardData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400">No players found on the leaderboard yet.</td>
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