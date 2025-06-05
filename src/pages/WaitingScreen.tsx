// Create file: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/src/pages/WaitingScreen.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, getGameDetails } from '../utils/supabase';
import { useAuth } from '../hooks/useAuth.js';
import { RealtimeChannel } from '@supabase/supabase-js';

const WaitingScreen: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth(); // Use auth loading state
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Don't proceed until auth is loaded and gameId is present
        if (authLoading || !gameId) {
            console.log(`[WaitingScreen] Waiting for auth (${authLoading}) or gameId (${gameId})`);
            return;
        }

        let channel: RealtimeChannel | null = null;
        let isMounted = true;

        const setupWaitingScreen = async () => {
            setLoading(true);
            setError(null);
            try {
                console.log(`[WaitingScreen] Setting up for game: ${gameId}`);
                const details = await getGameDetails(gameId);

                if (!isMounted) return;

                if (!details) {
                    throw new Error("Game not found or you don't have access.");
                }

                // Basic check: Is the current user part of this game?
                // More robust checks might be needed depending on requirements
                if (details.player1_id !== user?.id && details.player2_id !== user?.id) {
                     console.warn(`[WaitingScreen] User ${user?.id} is not part of game ${gameId}. Redirecting to lobby.`);
                     navigate('/lobby', { replace: true, state: { message: 'You are not part of that game.' } });
                     return;
                }

                setStatus(details.status);
                console.log(`[WaitingScreen] Initial status for ${gameId}: ${details.status}`);

                // Navigate immediately if status is already selecting or active
                if (details.status === 'selecting') {
                    console.log(`[WaitingScreen] Status is 'selecting'. Navigating to NFT selection.`);
                    navigate(`/nft-selection/${gameId}`, { replace: true });
                    return;
                }
                 if (details.status === 'active') {
                    console.log(`[WaitingScreen] Status is 'active'. Navigating to game screen.`);
                    navigate(`/game/${gameId}`, { replace: true });
                    return;
                }
                if (details.status !== 'waiting') {
                    console.log(`[WaitingScreen] Game status is not 'waiting' (${details.status}). Navigating to lobby.`);
                    navigate('/lobby', { replace: true, state: { message: `Game status is ${details.status}.` } });
                    return;
                }

                // If status is 'waiting', subscribe to changes
                console.log(`[WaitingScreen] Status is 'waiting'. Subscribing to updates for ${gameId}.`);
                channel = supabase
                    .channel(`game-status-${gameId}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'games',
                            filter: `id=eq.${gameId}`,
                        },
                        (payload) => {
                            if (!isMounted) return;
                            console.log('[WaitingScreen] Realtime update received:', payload);
                            const newStatus = payload.new?.status;
                            if (newStatus) {
                                setStatus(newStatus); // Update local status
                                console.log(`[WaitingScreen] Game status changed to: ${newStatus}`);
                                if (newStatus === 'selecting') {
                                    console.log(`[WaitingScreen] Opponent joined! Navigating to NFT selection.`);
                                    // Unsubscribe before navigating
                                    if (channel) {
                                        supabase.removeChannel(channel).then(() => {
                                            console.log('[WaitingScreen] Unsubscribed before navigation.');
                                            if (isMounted) navigate(`/nft-selection/${gameId}`, { replace: true });
                                        });
                                        channel = null; // Prevent double removal in cleanup
                                    } else if (isMounted) {
                                        navigate(`/nft-selection/${gameId}`, { replace: true });
                                    }
                                } else if (newStatus !== 'waiting') {
                                    // Handle other status changes if needed (e.g., cancelled remotely)
                                    console.log(`[WaitingScreen] Game status changed to ${newStatus}. Navigating to lobby.`);
                                     if (channel) {
                                        supabase.removeChannel(channel).then(() => {
                                             console.log('[WaitingScreen] Unsubscribed before navigation (non-selecting status).');
                                             if (isMounted) navigate('/lobby', { replace: true, state: { message: `Game status changed to ${newStatus}.` } });
                                        });
                                        channel = null;
                                     } else if (isMounted) {
                                         navigate('/lobby', { replace: true, state: { message: `Game status changed to ${newStatus}.` } });
                                     }
                                }
                            }
                        }
                    )
                    .subscribe((subStatus, err) => {
                        if (!isMounted) return;
                        if (subStatus === 'SUBSCRIBED') {
                            console.log(`[WaitingScreen] Subscribed successfully to status updates for ${gameId}`);
                            setLoading(false); // Stop loading once subscribed
                        } else if (err) {
                            console.error(`[WaitingScreen] Subscription error for ${gameId}:`, err);
                            setError('Failed to listen for game updates. Please try again.');
                            setLoading(false);
                        } else {
                            console.log(`[WaitingScreen] Subscription status: ${subStatus}`);
                        }
                    });

            } catch (err: any) {
                if (!isMounted) return;
                console.error("[WaitingScreen] Error checking status or subscribing:", err);
                setError(err.message || "Failed to load game details.");
                setLoading(false);
            }
        };

        setupWaitingScreen();

        // Cleanup function
        return () => {
            isMounted = false;
            if (channel) {
                console.log(`[WaitingScreen] Cleaning up subscription for ${gameId}`);
                supabase.removeChannel(channel);
                channel = null;
            }
        };
    }, [gameId, navigate, user?.id, authLoading]); // Depend on authLoading

    const handleBackToLobby = () => {
        navigate('/lobby');
    };

    // Display loading state while checking auth or initial game status
    if (authLoading || loading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-gray-400">
                <p>Loading game information...</p>
                <div className="animate-pulse text-lg mt-4">⏳</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-red-500">
                <p>Error: {error}</p>
                <button onClick={handleBackToLobby} className="mt-4 underline text-blue-400 hover:text-blue-300">
                    Back to Lobby
                </button>
            </div>
        );
    }

    // Only show waiting message if status is confirmed 'waiting'
    if (status === 'waiting') {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-gray-400">
                <h1 className="text-2xl text-white mb-4">Waiting for Opponent...</h1>
                <p className="mb-2">Game ID: <span className="text-yellow-500">{gameId}</span></p>
                <p className="mb-6">Share this ID or wait for someone to join from the lobby.</p>
                <div className="animate-pulse text-lg mb-8">⏳</div>
                <button
                    onClick={handleBackToLobby}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-200"
                >
                    Back to Lobby
                </button>
            </div>
        );
    }

    // Fallback or if status is unexpected (should have navigated away already)
    return (
         <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-gray-400">
            <p>Checking game status...</p>
             <button onClick={handleBackToLobby} className="mt-4 underline text-blue-400 hover:text-blue-300">
                 Back to Lobby
             </button>
         </div>
    );
};

export default WaitingScreen;