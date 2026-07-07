import React, { useEffect, useRef } from 'react';
import { ScrollText } from 'lucide-react';

interface LogsProps {
  logs: string[];
}

const Logs: React.FC<LogsProps> = ({ logs }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [logs]); // Scroll down whenever logs update

  // Filter out zero-damage combat logs
  const filteredLogs = logs.filter(log => {
    // Regex to match "Combat: Player X absorbs all damage (raw 0 - defense Y)."
    const zeroDamagePattern = /^Combat: Player \\d+ absorbs all damage \\(raw 0 - defense \\d+\\)\\.$/;
    // Keep logs that *don't* match the pattern
    return !zeroDamagePattern.test(log);
  });

  return (
    <div className="surface-obsidian flex h-full min-h-[220px] w-full flex-col overflow-hidden rounded-xl border p-3 text-white shadow-inner xl:min-h-0">
      <h3 className="mb-2 flex items-center gap-2 border-b border-white/10 px-1 pb-2 text-sm font-bold uppercase tracking-normal text-amber-200">
        <ScrollText className="h-4 w-4" aria-hidden />
        Game Log
      </h3>
      <div className="arena-scrollbar flex-grow space-y-1 overflow-y-auto pr-1 text-xs">
        {/* Render the filtered logs */} 
        {filteredLogs.map((log, index) => (
          <p key={index} className="my-0.5 rounded-md bg-white/[0.025] px-2 py-1 font-mono leading-tight text-slate-300">{log}</p>
        ))}
        <div ref={logsEndRef} /> {/* Invisible element to scroll to */}
      </div>
    </div>
  );
};

export default Logs;
