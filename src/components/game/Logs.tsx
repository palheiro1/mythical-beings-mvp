import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollText } from 'lucide-react';

interface LogsProps {
  logs: string[];
}

const Logs: React.FC<LogsProps> = ({ logs }) => {
  const logsListRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  // Filter out zero-damage combat logs
  const filteredLogs = useMemo(() => logs.filter(log => {
    // Regex to match "Combat: Player X absorbs all damage (raw 0 - defense Y)."
    const zeroDamagePattern = /^Combat: Player \\d+ absorbs all damage \\(raw 0 - defense \\d+\\)\\.$/;
    // Keep logs that *don't* match the pattern
    return !zeroDamagePattern.test(log);
  }), [logs]);

  useEffect(() => {
    const list = logsListRef.current;
    if (!list || !stickToBottomRef.current) return;
    list.scrollTop = list.scrollHeight;
  }, [filteredLogs.length]);

  const handleLogScroll = () => {
    const list = logsListRef.current;
    if (!list) return;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 32;
  };

  return (
    <div className="surface-obsidian flex h-full max-h-[360px] min-h-[220px] w-full flex-col overflow-hidden rounded-xl border p-3 text-white shadow-inner xl:max-h-none xl:min-h-0">
      <h3 className="mb-2 flex items-center gap-2 border-b border-white/10 px-1 pb-2 text-sm font-bold uppercase tracking-normal text-amber-200">
        <ScrollText className="h-4 w-4" aria-hidden />
        Game Log
      </h3>
      <div ref={logsListRef} onScroll={handleLogScroll} className="arena-scrollbar flex-grow space-y-1 overflow-y-auto pr-1 text-xs">
        {/* Render the filtered logs */} 
        {filteredLogs.map((log, index) => (
          <p key={index} className="my-0.5 rounded-md bg-white/[0.025] px-2 py-1 font-mono leading-tight text-slate-300">{log}</p>
        ))}
      </div>
    </div>
  );
};

export default Logs;
