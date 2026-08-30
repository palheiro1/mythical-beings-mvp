import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ScrollText } from 'lucide-react';
import { formatGameHistoryEntry } from '../../utils/gameHistory.js';

interface LogsProps {
  logs: string[];
  playerLabels?: Record<string, string>;
}

const EMPTY_PLAYER_LABELS: Record<string, string> = {};

const Logs: React.FC<LogsProps> = ({ logs, playerLabels = EMPTY_PLAYER_LABELS }) => {
  const headingId = React.useId();
  const logsListRef = useRef<HTMLOListElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const visibleLogs = useMemo(
    () => logs.map((log) => formatGameHistoryEntry(log, playerLabels)),
    [logs, playerLabels],
  );

  const jumpToLatest = useCallback(() => {
    const list = logsListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current) jumpToLatest();
  }, [jumpToLatest, visibleLogs.length]);

  const handleLogScroll = () => {
    const list = logsListRef.current;
    if (!list) return;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 32;
    setShowJumpToLatest(!stickToBottomRef.current);
  };

  const latestEntry = visibleLogs[visibleLogs.length - 1] ?? '';

  return (
    <section
      aria-labelledby={headingId}
      className="surface-obsidian relative flex h-full max-h-[360px] min-h-[220px] w-full flex-col overflow-hidden rounded-xl border p-3 text-white shadow-inner xl:max-h-none xl:min-h-0"
    >
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 px-1 pb-2">
        <h3 id={headingId} className="flex items-center gap-2 text-sm font-bold uppercase tracking-normal text-amber-200">
          <ScrollText className="h-4 w-4" aria-hidden />
          Game history
        </h3>
        <span className="text-[0.7rem] text-slate-400">
          {visibleLogs.length} {visibleLogs.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {latestEntry ? `Latest event: ${latestEntry}` : 'No game events yet.'}
      </p>

      <ol
        ref={logsListRef}
        onScroll={handleLogScroll}
        aria-label="Complete game history"
        aria-live="off"
        className="arena-scrollbar flex-grow list-none space-y-1 overflow-y-auto pr-1 text-xs"
      >
        {visibleLogs.map((log, index) => (
          <li
            key={`${index}-${log}`}
            className="my-0.5 grid grid-cols-[2rem_1fr] gap-1 rounded-md bg-white/[0.025] px-2 py-1 font-mono leading-tight text-slate-300"
          >
            <span aria-hidden className="text-right text-slate-500">{index + 1}.</span>
            <span>{log}</span>
          </li>
        ))}
      </ol>

      {showJumpToLatest && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-4 right-4 inline-flex min-h-9 items-center gap-1 rounded-full border border-amber-300/40 bg-slate-950/95 px-3 py-1 text-xs font-bold text-amber-100 shadow-lg hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          Jump to latest event
        </button>
      )}
    </section>
  );
};

export default Logs;
