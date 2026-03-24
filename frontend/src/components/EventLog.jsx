import { useState, useMemo } from 'react';
import { Filter } from 'lucide-react';
import useStore from '../store/useStore';

const EVENT_BADGES = {
  ENTRY: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  EXIT: 'bg-slate-600/20 text-slate-400 border-slate-500/30',
  SL_HIT: 'bg-red-600/20 text-red-400 border-red-500/30',
  TARGET_HIT: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
  TIME_EXIT: 'bg-amber-600/20 text-amber-400 border-amber-500/30',
  RISK_STOP: 'bg-red-600/30 text-red-300 border-red-400/30',
  DATA_WARNING: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
};

const DEFAULT_BADGE = 'bg-slate-600/20 text-slate-400 border-slate-500/30';

function EventLog() {
  const backtestEvents = useStore((s) => s.backtestEvents);
  const [typeFilter, setTypeFilter] = useState('ALL');

  const eventTypes = useMemo(() => {
    const types = new Set();
    backtestEvents.forEach((e) => {
      if (e.event_type) types.add(e.event_type);
    });
    return ['ALL', ...Array.from(types).sort()];
  }, [backtestEvents]);

  const filteredEvents = useMemo(() => {
    const events = typeFilter === 'ALL'
      ? backtestEvents
      : backtestEvents.filter((e) => e.event_type === typeFilter);
    // Sort by timestamp descending (newest first)
    return [...events].sort((a, b) => {
      const ta = a.timestamp || '';
      const tb = b.timestamp || '';
      return tb.localeCompare(ta);
    });
  }, [backtestEvents, typeFilter]);

  if (backtestEvents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <p className="text-sm">Event log will populate when backtest runs</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/50 shrink-0 bg-slate-800/30">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400">Filter:</span>
        <div className="flex gap-1.5 flex-wrap">
          {eventTypes.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                typeFilter === type
                  ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/30 hover:text-white hover:border-slate-600'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 ml-auto mono">{filteredEvents.length} events</span>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-auto">
        {filteredEvents.map((event, i) => {
          const badgeClass = EVENT_BADGES[event.event_type] || DEFAULT_BADGE;
          const time = formatEventTime(event.timestamp);
          const pnl = event.pnl;
          const price = event.price;

          return (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-3 border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors"
            >
              <span className="text-xs mono text-slate-400 whitespace-nowrap shrink-0">{time}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${badgeClass}`}>
                {event.event_type}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white">{event.symbol}</span>
                {event.details && (
                  <span className="text-sm text-slate-400 ml-2">{event.details}</span>
                )}
              </div>
              {price != null && (
                <span className="text-xs mono text-slate-300 shrink-0">
                  {Number(price).toFixed(2)}
                </span>
              )}
              {pnl != null && (
                <span className={`text-xs mono font-medium shrink-0 ${
                  pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {pnl >= 0 ? '+' : ''}{Number(pnl).toFixed(2)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatEventTime(timestamp) {
  if (!timestamp) return '';
  try {
    const d = new Date(timestamp);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return String(timestamp);
  }
}

export default EventLog;
