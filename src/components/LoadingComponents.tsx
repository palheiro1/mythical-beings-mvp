import React from 'react';

interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ 
  count = 1, 
  className = '' 
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`bg-white/10 backdrop-blur-sm rounded-xl animate-pulse ${className}`}
          style={{ aspectRatio: '3/4' }}
        >
          <div className="p-4 h-full flex flex-col justify-between">
            {/* Card header */}
            <div className="space-y-2">
              <div className="h-4 bg-white/20 rounded w-3/4"></div>
              <div className="h-3 bg-white/15 rounded w-1/2"></div>
            </div>
            
            {/* Card image placeholder */}
            <div className="flex-1 my-4 bg-white/10 rounded-lg flex items-center justify-center">
              <div className="w-12 h-12 bg-white/20 rounded-full"></div>
            </div>
            
            {/* Card stats */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-3 bg-white/15 rounded w-8"></div>
                <div className="h-3 bg-white/15 rounded w-8"></div>
              </div>
              <div className="h-2 bg-white/10 rounded w-full"></div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

interface LoadingStateProps {
  message?: string;
  showCards?: boolean;
  cardCount?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Loading your cards...', 
  showCards = true,
  cardCount = 6 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-8 bg-white/20 rounded w-64 mx-auto mb-4 animate-pulse"></div>
          <div className="h-4 bg-white/15 rounded w-48 mx-auto animate-pulse"></div>
        </div>
        
        {/* Loading message */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 text-white/80">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/60"></div>
            <span>{message}</span>
          </div>
        </div>
        
        {/* Card grid skeleton */}
        {showCards && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton count={cardCount} />
          </div>
        )}
        
        {/* Bottom controls skeleton */}
        <div className="mt-8 flex justify-center space-x-4">
          <div className="h-12 bg-white/20 rounded-lg w-32 animate-pulse"></div>
          <div className="h-12 bg-white/20 rounded-lg w-24 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

interface ConnectionStatusProps {
  isConnected: boolean;
  realtimeFailed: boolean;
  onReconnect?: () => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  realtimeFailed,
  onReconnect
}) => {
  if (isConnected && !realtimeFailed) {
    return null; // Don't show anything when connection is good
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`
        px-4 py-2 rounded-lg text-sm flex items-center space-x-2 shadow-lg
        ${realtimeFailed 
          ? 'bg-yellow-600 text-white' 
          : 'bg-red-600 text-white'
        }
      `}>
        <div className={`
          w-2 h-2 rounded-full
          ${realtimeFailed ? 'bg-yellow-300' : 'bg-red-300 animate-pulse'}
        `}></div>
        
        <span>
          {realtimeFailed ? 'Using backup mode' : 'Connecting...'}
        </span>
        
        {realtimeFailed && onReconnect && (
          <button
            onClick={onReconnect}
            className="ml-2 text-xs underline hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};
