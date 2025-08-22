import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import {
  supabase,
  getAvailableGames,
  getActiveGames,
  createGame,
  joinGame,
  getProfile,
} from "../utils/supabase.js";
import { AvailableGame } from "../game/types.js";
import { v4 as uuidv4 } from "uuid";
import { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";
// NavBar is provided at the app level

// Define the combined type for games with creator's username
interface GameWithUsername extends AvailableGame {
  creatorUsername: string | null;
}

// Define type for online user profile info
interface OnlineUserInfo {
  username: string | null;
  avatar_url: string | null;
}

// Add this function to authenticate with wallet
const authenticateWithWallet = async (walletAddress: string) => {
  if (!walletAddress) {
    console.error("[authenticateWithWallet] No wallet address provided");
    throw new Error("No wallet address provided");
  }

  console.log(
    "[authenticateWithWallet] Attempting to authenticate with wallet:",
    walletAddress,
  );

  try {
    // Option 2: Sign in anonymously but associate the wallet address
    const { data, error } = await supabase.auth.signUp({
      email: `${walletAddress.toLowerCase().substring(2, 12)}@ethereum.player`,
      password: `pw_${walletAddress.toLowerCase()}`, // Never exposed, just for authentication
      options: {
        data: {
          eth_address: walletAddress, // Store the wallet address in user metadata
        },
      },
    });

    if (error) {
      // If user already exists, try signing in instead
      if (error.message.includes("already registered")) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: `${walletAddress.toLowerCase().substring(2, 12)}@ethereum.player`,
            password: `pw_${walletAddress.toLowerCase()}`,
          });

        if (signInError) {
          console.error("[authenticateWithWallet] Sign in error:", signInError);
          throw signInError;
        }

        console.log(
          "[authenticateWithWallet] Successfully signed in existing user",
        );
        return signInData;
      }

      console.error("[authenticateWithWallet] Authentication error:", error);
      throw error;
    }

    console.log("[authenticateWithWallet] Authentication successful:", data);

    // Phase 2 Enhancement: Create/update profile immediately after authentication
    if (data && data.user) {
      try {
        const userId = data.user.id;
        console.log(
          "[Wallet Auth] Creating/updating profile for user:",
          userId,
        );
        const { error } = await supabase.from("profiles").upsert(
          {
            id: userId,
            username: `Player_${userId.substring(0, 6)}`,
            eth_address: walletAddress,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

        if (error) {
          console.error(
            "[Wallet Auth] Error ensuring profile exists:",
            error.message,
          );
        } else {
          console.log("[Wallet Auth] Profile created/updated successfully");
        }
      } catch (e) {
        console.error(
          "[Wallet Auth] Exception while creating profile:",
          e instanceof Error ? e.message : String(e),
        );
      }
    }

    return data;
  } catch (error) {
    console.error("[authenticateWithWallet] Authentication failed:", error);
    throw error;
  }
};

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: idLoading, error: authError } = useAuth();
  const playerId = user?.id;
  const playerError = authError;
  const [availableGames, setAvailableGames] = useState<GameWithUsername[]>([]);
  const [activeGames, setActiveGames] = useState<GameWithUsername[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [userProfile, setUserProfile] = useState<OnlineUserInfo>({
    username: null,
    avatar_url: null,
  });
  const [onlineUsers, setOnlineUsers] = useState<
    Record<string, OnlineUserInfo>
  >({});
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const isLoading = idLoading || loadingGames;

  console.log("[Lobby] Rendering component...", {
    isLoading,
    error,
    gamesCount: availableGames.length,
    playerId,
  });

  const fetchGamesAndProfiles = useCallback(async () => {
    console.log("[Lobby] fetchGamesAndProfiles: Fetching games...");
    setLoadingGames(true);
    setError(null);
    try {
      const [fetchedJoinable, fetchedActive] = await Promise.all([
        getAvailableGames(),
        getActiveGames(),
      ]);

      const enrich = async (games: any[] | null): Promise<GameWithUsername[]> => {
        if (!games) return [];
        return Promise.all(
          games.map(async (game) => {
            let creatorUsername = null;
            if (game.player1_id) {
              try {
                const profile = await getProfile(game.player1_id);
                creatorUsername = profile?.username || game.player1_id.substring(0, 8);
              } catch (profileError) {
                console.error(
                  `[Lobby] Error fetching profile for player1_id ${game.player1_id}:`,
                  profileError,
                );
                creatorUsername = game.player1_id.substring(0, 8);
              }
            }
            return { ...game, creatorUsername };
          })
        );
      };

      const [joinableWithNames, activeWithNames] = await Promise.all([
        enrich(fetchedJoinable),
        enrich(fetchedActive),
      ]);

      setAvailableGames(joinableWithNames);
      setActiveGames(activeWithNames);
      setError(null);
    } catch (error) {
      console.error(
        "[Lobby] fetchGamesAndProfiles: Error fetching games or profiles:",
        error,
      );
      setError("Failed to fetch games or creator profiles");
      setAvailableGames([]);
      setActiveGames([]);
    } finally {
      console.log(
        "[Lobby] fetchGamesAndProfiles: Setting loadingGames to false.",
      );
      setLoadingGames(false);
    }
  }, []);

  useEffect(() => {
    // Fetch games only when authentication is complete and player is identified
    if (!idLoading && playerId && !playerError) {
      fetchGamesAndProfiles();
    }
  }, [idLoading, playerId, playerError, fetchGamesAndProfiles]);

  useEffect(() => {
    if (playerError) {
      console.warn("[Lobby] Player identification error:", playerError);
      // Only set notification if it's a persistent error (not just loading)
      if (playerId === null && !idLoading) {
        setNotification(
          `Error identifying player: ${playerError}. Please refresh.`,
        );
      }
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [playerError, playerId, idLoading]);

  useEffect(() => {
    // Fetch user's own profile using the EVM address (playerId)
    if (playerId) {
      getProfile(playerId)
        .then((profile: any) => {
          setUserProfile({
            username: profile?.username || null,
            avatar_url: profile?.avatar_url || null,
          });
        })
        .catch((err: any) => {
          console.error(
            `[Lobby] Error fetching own profile using EVM address ${playerId}:`,
            err,
          );
          // Optionally set a default/error state for userProfile if needed
        });
    } else if (!idLoading && !playerError) {
      console.warn(
        `[Lobby] Own EVM address (playerId) not available for profile fetch.`,
      );
    }
  }, [playerId, idLoading, playerError]);

  useEffect(() => {
    if (!supabase) return;

    console.log("[Lobby Realtime] Setting up games subscription.");
    const gamesChannel = supabase
      .channel("public:games")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "games",
          filter: "status=in.(waiting,active)",
        },
        async (payload: any) => {
          console.log("[Lobby Realtime] New game detected:", payload.new);
          const newGame = payload.new as AvailableGame;

          let creatorUsername = null;
          if (newGame.player1_id) {
            // newGame.player1_id should be a UUID
            try {
              const profile = await getProfile(newGame.player1_id); // Ensure this is called with UUID
              creatorUsername =
                profile?.username || newGame.player1_id.substring(0, 8);
            } catch (err: any) {
              console.error(
                "[Lobby Realtime] Error fetching profile for new game creator:",
                err,
              );
              creatorUsername = newGame.player1_id.substring(0, 8); // Fallback, but ideally handle error
            }
          }

          const gameWithUsername: GameWithUsername = {
            ...newGame,
            creatorUsername,
          };

          if (newGame.status === "waiting") {
            setAvailableGames((currentGames) => {
              if (currentGames.some((game) => game.id === gameWithUsername.id)) {
                return currentGames;
              }
              return [...currentGames, gameWithUsername];
            });
          } else if (newGame.status === "active") {
            setActiveGames((currentGames) => {
              if (currentGames.some((game) => game.id === gameWithUsername.id)) {
                return currentGames;
              }
              return [gameWithUsername, ...currentGames];
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games" },
        (payload: any) => {
          console.log("[Lobby Realtime] Game update detected:", payload.new);
          const updatedGame = payload.new as AvailableGame;
          setAvailableGames((currentGames) =>
            currentGames
              .map((game) =>
                game.id === updatedGame.id
                  ? {
                      ...game,
                      ...updatedGame,
                      creatorUsername: game.creatorUsername,
                    }
                  : game,
              )
              .filter((game) => game.status === "waiting"),
          );
          setActiveGames((current) => {
            const exists = current.some((g) => g.id === updatedGame.id);
            // If game turned active, move it to active list
            if (updatedGame.status === "active") {
              const without = current.filter((g) => g.id !== updatedGame.id);
              const incoming: GameWithUsername = {
                ...(exists ? (current.find((g) => g.id === updatedGame.id) as GameWithUsername) : (updatedGame as any)),
                ...updatedGame,
              } as GameWithUsername;
              return [incoming, ...without];
            }
            // If game left active, remove it
            if (exists) {
              return current.filter((g) => g.id !== updatedGame.id);
            }
            // Else update in place
            return current.map((g) => (g.id === updatedGame.id ? { ...g, ...updatedGame } : g));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "games" },
        (payload: any) => {
          console.log("[Lobby Realtime] Game delete detected:", payload.old);
          const deletedGameId = payload.old.id;
          setAvailableGames((currentGames) =>
            currentGames.filter((game) => game.id !== deletedGameId),
          );
          setActiveGames((currentGames) =>
            currentGames.filter((game) => game.id !== deletedGameId),
          );
        },
      )
      .subscribe((status: any, err: any) => {
        if (status === "SUBSCRIBED") {
          console.log(
            "[Lobby Realtime] Successfully subscribed to games channel.",
          );
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[Lobby Realtime] Subscription error:", err);
          setError("Realtime connection error for game list.");
        }
      });

    return () => {
      if (gamesChannel) {
        console.log("[Lobby Realtime] Unsubscribing from games channel.");
        supabase.removeChannel(gamesChannel);
      }
    };
  }, [supabase]);

  useEffect(() => {
    // Use Supabase UUID (playerId) for presence key
    const supabaseUserIdForPresence = playerId;
    if (!supabase || !supabaseUserIdForPresence) {
      console.log(
        "[Lobby Presence] Waiting for Supabase client or Supabase User ID (playerId) before subscribing to presence.",
      );
      return;
    }
    console.log(
      "[Lobby Presence] Setting up presence channel for Supabase user:",
      supabaseUserIdForPresence,
    );
    const channel = supabase.channel("lobby-presence", {
      config: {
        presence: {
          key: supabaseUserIdForPresence, // Supabase UUID
        },
      },
    });

    const fetchProfileForUser = async (userId: string) => {
      if (!onlineUsers[userId]) {
        try {
          const profile = await getProfile(userId);
          setOnlineUsers((prev) => ({
            ...prev,
            [userId]: {
              username: profile?.username || `User (${userId.substring(0, 6)})`,
              avatar_url: profile?.avatar_url || null,
            },
          }));
        } catch (err: any) {
          console.error(
            `[Lobby Presence] Error fetching profile for ${userId}:`,
            err,
          );
          setOnlineUsers((prev) => ({
            ...prev,
            [userId]: {
              username: `User (${userId.substring(0, 6)})`,
              avatar_url: null,
            },
          }));
        }
      }
    };

    channel
      .on("presence", { event: "sync" }, () => {
        console.log("[Lobby Presence] Sync event received.");
        const newState: RealtimePresenceState = channel.presenceState();
        console.log("[Lobby Presence] Current presence state:", newState);
        const userIds = Object.keys(newState);
        userIds.forEach(fetchProfileForUser);
        setOnlineUsers((currentUsers) => {
          const updatedUsers: Record<string, OnlineUserInfo> = {};
          userIds.forEach((id) => {
            if (currentUsers[id]) {
              updatedUsers[id] = currentUsers[id];
            }
          });
          return updatedUsers;
        });
      })
      .on(
        "presence",
        { event: "join" },
        ({ key, newPresences }: { key: string; newPresences: any }) => {
          console.log("[Lobby Presence] Join event:", { key, newPresences });
          fetchProfileForUser(key);
        },
      )
      .on(
        "presence",
        { event: "leave" },
        ({ key, leftPresences }: { key: string; leftPresences: any }) => {
          console.log("[Lobby Presence] Leave event:", { key, leftPresences });
          setOnlineUsers((prev) => {
            const updated = { ...prev };
            delete updated[key];
            return updated;
          });
        },
      )
      .subscribe(async (status: any) => {
        if (status === "SUBSCRIBED") {
          console.log(
            "[Lobby Presence] Successfully subscribed to presence channel.",
          );
          // Track with their Supabase UUID as key. Additional info can be passed.
          await channel.track({
            user_id: supabaseUserIdForPresence,
            username:
              userProfile.username ||
              `User (${supabaseUserIdForPresence.substring(0, 6)})`,
          });
          console.log(
            "[Lobby Presence] User tracked with key:",
            supabaseUserIdForPresence,
          );
        } else if (status === "CLOSED") {
          console.log("[Lobby Presence] Channel closed.");
        } else {
          console.error("[Lobby Presence] Subscription error/status:", status);
          setError("Realtime connection error for online players.");
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      if (presenceChannelRef.current) {
        console.log("[Lobby Presence] Unsubscribing and removing channel.");
        presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [supabase, playerId, userProfile.username]);

  const handleJoinGame = async (gameId: string) => {
    // playerId from usePlayerIdentification should be the EVM address.
    if (!playerId) {
      setNotification(
        "Cannot join game: User (EVM address) not identified. Please ensure you are fully logged in.",
      );
      setTimeout(() => setNotification(null), 3000);
      console.error(
        "[Lobby] Attempted to join game without a valid EVM address (playerId).",
      );
      return;
    }
    console.log(
      `[Lobby] Player ${playerId} (EVM address) attempting to join game: ${gameId}`,
    );
    setNotification(`Joining game ${gameId}...`);
    try {
      // Must use the EVM address (playerId)
      const joinedGame = await joinGame(gameId, playerId);
      if (joinedGame) {
        console.log(
          `[Lobby] Successfully joined game ${gameId} as player ${playerId}. Triggering card dealing...`,
        );
        setNotification("Game joined! Dealing cards...");
        const { error: functionError } = await supabase.functions.invoke(
          "deal-cards",
          {
            body: { gameId },
          },
        );

        if (functionError) {
          console.error(
            "[Lobby] Error calling deal-cards function:",
            functionError,
          );
          let errorMsg = "Joined game, but failed to deal cards.";
          if (
            functionError.message.includes("already dealt") ||
            functionError.message.includes("status")
          ) {
            errorMsg =
              "Game setup issue. Cards might already be dealt or status incorrect.";
          } else if (functionError.message.includes("Not enough creatures")) {
            errorMsg =
              "Game configuration error: Not enough creatures defined.";
          }
          setNotification(
            `${errorMsg} Please try rejoining or contact support.`,
          );
          setTimeout(() => setNotification(null), 6000);
        } else {
          console.log(
            "[Lobby] deal-cards function invoked successfully. Navigating to NFT Selection...",
          );
          setNotification("Cards dealt! Starting selection...");
          navigate(`/nft-selection/${gameId}`);
        }
      } else {
        const { data: gameData, error: fetchError } = await supabase
          .from("games")
          .select(
            "player1_id, player2_id, status, player1_dealt_hand, player2_dealt_hand",
          )
          .eq("id", gameId)
          .single();

        if (fetchError) throw fetchError;

        // Direct comparison since we're using Supabase user IDs now
        if (
          gameData &&
          (gameData.player1_id === playerId || gameData.player2_id === playerId)
        ) {
          console.log(
            `[Lobby] User is already in game ${gameId}. Checking status...`,
          );
          const noHandsDealt =
            (!gameData.player1_dealt_hand || gameData.player1_dealt_hand.length === 0) &&
            (!gameData.player2_dealt_hand || gameData.player2_dealt_hand.length === 0);
          if (gameData.status === "active" && noHandsDealt) {
            console.log(
              "[Lobby] Game is active but hands are empty. Invoking deal-cards for recovery...",
            );
            try {
              await supabase.functions.invoke("deal-cards", { body: { gameId } });
            } catch (e) {
              console.warn("[Lobby] deal-cards recovery attempt failed:", e);
            }
            navigate(`/nft-selection/${gameId}`);
          } else if (
            gameData.status === "selecting" ||
            gameData.status === "active" ||
            (gameData.player1_dealt_hand &&
              gameData.player1_dealt_hand.length > 0)
          ) {
            console.log(
              `[Lobby] Game status is '${gameData.status}'. Navigating to NFT Selection...`,
            );
            navigate(`/nft-selection/${gameId}`);
          } else if (
            gameData.status === "waiting" &&
            gameData.player2_id === playerId
          ) {
            setNotification(
              "You seem to be in the game, but setup might be incomplete. Trying to initiate setup...",
            );
            setTimeout(() => setNotification(null), 4000);
            await supabase.functions.invoke("deal-cards", { body: { gameId } });
            navigate(`/nft-selection/${gameId}`);
          } else {
            setNotification(
              "Already in game, but current status is unclear. Refreshing...",
            );
            setTimeout(() => setNotification(null), 4000);
            fetchGamesAndProfiles();
          }
        } else if (gameData && gameData.status !== "waiting") {
          setNotification(
            "Failed to join: Game is already full or in progress.",
          );
          setTimeout(() => setNotification(null), 4000);
          fetchGamesAndProfiles();
        } else {
          setNotification(
            "Failed to join game. It might no longer be available.",
          );
          setTimeout(() => setNotification(null), 4000);
          fetchGamesAndProfiles();
        }
      }
    } catch (error: any) {
      console.error(`[Lobby] Error joining game ${gameId}:`, error);
      setNotification(
        `Error joining game: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setTimeout(() => setNotification(null), 4000);
      fetchGamesAndProfiles();
    }
  };

  const handleCreateGame = async () => {
    if (!playerId) {
      setNotification("Please connect your wallet to create a game.");
      return;
    }

    // Check for active Supabase session first
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      // Try to sign in the user with their wallet
      setNotification("Authenticating with Supabase...");
      await authenticateWithWallet(playerId);

      // Check again after authentication attempt
      const { data: newSession } = await supabase.auth.getSession();
      if (!newSession?.session) {
        setNotification("Authentication failed. Please try again.");
        return;
      }
    }

    // Create profile record if needed
    try {
      // Use Supabase user ID directly now
      setNotification("Setting up player profile...");
      await supabase.from("profiles").upsert(
        {
          id: playerId,
          username: `Player_${playerId.substring(0, 6)}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    } catch (profileError) {
      console.error("[Lobby] Error creating profile:", profileError);
      // Continue anyway - the error might be that the profile already exists
    }

    // Now proceed with game creation
    console.log(
      "[Lobby] Creating game with bet amount:",
      betAmount,
      "by player (EVM address):",
      playerId,
    );
    setIsCreating(true);
    const newGameId = uuidv4();
    try {
      // Must use the EVM address (playerId)
      const createdGame = await createGame(newGameId, playerId, betAmount);
      if (createdGame) {
        setShowCreateModal(false);
        setNotification(
          "Game created successfully! Proceeding to NFT Selection...",
        );
        navigate(`/nft-selection/${newGameId}`);
      } else {
        setNotification(
          "Failed to create game. The game ID might already exist or another error occurred.",
        );
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (error: any) {
      console.error("[Lobby] Error creating game:", error);
      setNotification(
        `Failed to create game: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsCreating(false);
    }
  };

  console.log("[Lobby] Preparing to return JSX...", {
    isLoading,
    error,
    playerId,
  });

  // Redirect if user is not authenticated and loading is complete
  if (!idLoading && !playerId) {
    console.log(
      "[Lobby] User not signed in (no playerId), redirecting to home.",
    );
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden pt-16">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        <div className="flex justify-center mb-6">
          <img src="/images/banner.png" alt="Mythical Beings" className="w-full max-w-3xl h-auto rounded-lg shadow-lg" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-cyan-400/10 pointer-events-none -z-10" />

        {isLoading ? (
          <div className="text-center text-gray-400 py-10">
            Loading Lobby...
          </div>
        ) : playerError && !playerId && !idLoading ? (
          <div className="text-center text-red-400 py-10">
            Error: {playerError}. Please refresh or check URL parameters if
            testing.
          </div>
        ) : error ? (
          <div className="text-center text-red-400 py-10">
            Error loading games: {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col gap-4">
              <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
                <span className="text-purple-400 text-2xl">👥</span>
                Players Online ({Object.keys(onlineUsers).length})
              </h2>
              <div className="space-y-3 overflow-y-auto max-h-60 pr-2">
                {Object.entries(onlineUsers).length > 0 ? (
                  Object.entries(onlineUsers).map(([userId, profile]) => (
                    <div
                      key={userId}
                      className="flex items-center space-x-3 p-2 bg-gray-700 rounded-md"
                    >
                      <img
                        width={32}
                        height={32}
                        src={
                          profile.avatar_url ||
                          `/api/placeholder-avatar?text=${profile.username?.charAt(0).toUpperCase() || "?"}`
                        }
                        alt={profile.username || "User Avatar"}
                        className="h-8 w-8 rounded-full object-cover border border-gray-500"
                      />
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {profile.username || `User (${userId.substring(0, 6)})`}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-4">
                    No other players currently online.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col gap-4">
              <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100 flex items-center justify-center gap-2">
                <span className="text-yellow-400 text-2xl">🎮</span>
                Available Games
              </h2>
              <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
                {availableGames.length > 0 ? (
                  availableGames.map((game) => (
                    <div
                      key={game.id}
                      className="bg-gray-700 p-4 rounded-lg flex justify-between items-center shadow-md"
                    >
                      <div>
                        <p className="text-lg font-semibold">
                          {game.creatorUsername || "Unknown Creator"}
                        </p>
                        <p className="text-sm text-gray-400">
                          Bet: {game.bet_amount} GEM
                        </p>
                        <p
                          className={`text-sm font-medium ${game.status === "waiting" ? "text-yellow-400" : "text-green-400"}`}
                        >
                          {game.status === "waiting"
                            ? "Waiting..."
                            : game.status.charAt(0).toUpperCase() +
                              game.status.slice(1)}
                        </p>
                      </div>
                      <div className="text-right">
                        {game.status === "waiting" &&
                          game.player1_id !== playerId && (
                            <button
                              onClick={() => handleJoinGame(game.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors duration-200"
                            >
                              Join Game
                            </button>
                          )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-4">
                    No available games right now.
                  </div>
                )}
              </div>

              <div className="border-t border-gray-700 my-4" />
              <h3 className="text-xl font-semibold mb-2 text-center text-gray-100 flex items-center justify-center gap-2">
                <span className="text-green-400 text-xl">👀</span>
                Watch live
              </h3>
              <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2">
                {activeGames.length > 0 ? (
                  activeGames.map((game) => (
                    <div
                      key={game.id}
                      className="bg-gray-700 p-4 rounded-lg flex justify-between items-center shadow-md"
                    >
                      <div>
                        <p className="text-lg font-semibold">
                          {game.creatorUsername || "Unknown Creator"}
                        </p>
                        <p className="text-sm text-gray-400">In progress</p>
                      </div>
                      <div className="text-right">
                        <button
                          onClick={() => navigate(`/game/${game.id}`)}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors duration-200"
                        >
                          Spectate
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-2">
                    No live games at the moment.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-800 bg-opacity-70 p-6 rounded-xl shadow-xl flex flex-col items-center gap-5">
              <h2 className="text-2xl font-semibold mb-3 text-center text-gray-100">
                Actions
              </h2>
              {playerId ? (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white text-lg font-semibold py-3 px-6 rounded-md transition-colors duration-200 w-full max-w-[200px]"
                >
                  Create Game
                </button>
              ) : (
                <p className="text-gray-400 text-center">
                  Please connect your wallet to create a game.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40"></div>
      )}
      {showCreateModal && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 p-6 rounded-lg shadow-lg max-w-md z-50">
          <h2 className="text-xl font-semibold text-center mb-4">
            Create New Game
          </h2>
          <div className="flex flex-col gap-4">
            <label
              htmlFor="bet-amount"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Bet Amount (0 for Free)
            </label>
            <div className="flex items-center bg-gray-700 rounded-md border border-gray-600">
              <input
                id="bet-amount"
                type="number"
                min="0"
                value={betAmount}
                onChange={(e) =>
                  setBetAmount(Math.max(0, Number(e.target.value)))
                }
                className="flex-grow p-3 rounded-l-md bg-transparent text-white focus:outline-none"
                placeholder="Enter bet amount"
              />
              <img
                src="/images/assets/gem.png"
                alt="GEM"
                className="h-6 w-6 mx-3"
              />
            </div>

            <div className="flex gap-4 mt-4">
              <button
                onClick={handleCreateGame}
                disabled={isCreating}
                className={`flex-1 py-3 px-6 rounded-md text-white font-semibold ${isCreating ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 transition-colors duration-200"}`}
              >
                {isCreating ? "Creating..." : "Confirm & Create"}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 px-6 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white px-4 py-2 rounded-full text-sm shadow-lg z-50">
          {notification}
        </div>
      )}
    </div>
  );
};

export default Lobby;
