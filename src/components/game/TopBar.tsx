import React from 'react';

// Define ProfileInfo type again or import
interface ProfileInfo {
    username: string | null;
    avatar_url: string | null;
}

interface TopBarProps {
  player1Profile: ProfileInfo;
  player2Profile: ProfileInfo;
  player1Mana: number;
  player2Mana: number;
  turn: number;
  phase: string;
  onLobbyReturn: () => void; // Callback to return to lobby
}

const TopBar: React.FC<TopBarProps> = ({
  player1Profile,
  player2Profile,
  player1Mana,
  player2Mana,
  turn,
  phase,
  onLobbyReturn
}) => {

  return (
    <div className="flex items-center justify-between p-3 bg-gray-900/80 backdrop-blur-sm text-white shadow-md h-16">
      {/* Player 1 Info */}
      <div className="flex items-center space-x-3">
        {/* Avatar */}
        <img
          src={
            player1Profile.avatar_url
              ? player1Profile.avatar_url
              : `/api/placeholder-avatar?text=${player1Profile.username?.charAt(0).toUpperCase()}`
          }
          alt="Player 1 Avatar"
          width={34}
          height={34}
          className="rounded-full object-cover"
        />
        <div className="flex flex-col min-w-0">
           <span className="font-semibold text-sm truncate max-w-[150px]">{player1Profile.username || 'Player 1'}</span>
           <span className="text-xs text-blue-300">Mana: {player1Mana}</span>
        </div>
      </div>

      {/* Game Info */}
      <div className="text-center">
        <div className="text-lg font-bold">Turn {turn}</div>
        <div className="text-sm text-yellow-300">{phase.toUpperCase()} Phase</div>
      </div>

      {/* Player 2 Info */}
      <div className="flex items-center space-x-3">
        <div className="flex flex-col items-end text-right space-y-1 min-w-0">
          <span className="font-semibold text-sm truncate max-w-[150px]">{player2Profile.username || 'Player 2'}</span>
          <span className="text-xs text-red-300">Mana: {player2Mana}</span>
        </div>
        {/* Avatar */}
        <img
          src={
            player2Profile.avatar_url
              ? player2Profile.avatar_url
              : `/api/placeholder-avatar?text=${player2Profile.username?.charAt(0).toUpperCase()}`
          }
          alt="Player 2 Avatar"
          width={34}
          height={34}
          className="rounded-full object-cover"
        />
      </div>

       {/* Return to Lobby Button */}
       <button
           onClick={onLobbyReturn}
           className="ml-4 bg-gray-600 hover:bg-gray-700 text-white text-xs font-semibold py-1 px-3 rounded-md transition-colors duration-200"
           title="Return to Lobby"
       >
           Lobby
       </button>
    </div>
  );
};

export default TopBar;