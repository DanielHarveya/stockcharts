import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import useStore from '../store/useStore';
import BacktestControls from './BacktestControls';

const INTERVAL_OPTIONS = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
];

function BacktestRunner() {
  const {
    strategies, currentStrategy, setCurrentStrategy, loadStrategies,
    backtestConfig, setBacktestConfig, backtestId, backtestStatus,
    addResult, setBacktestStatus, setBacktestElapsed,
  } = useStore();

  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Load strategies on mount
  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  // WebSocket connection when backtest starts
  const connectWs = useCallback(() => {
    if (!backtestId) return;
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/api/backtest/${backtestId}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const result = JSON.parse(event.data);
        if (result.status === 'completed') {
          setBacktestStatus('completed');
        } else if (result.status === 'error') {
          setBacktestStatus('stopped');
        } else {
          addResult(result);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    wsRef.current = ws;
  }, [backtestId, addResult, setBacktestStatus]);

  useEffect(() => {
    if (backtestId && backtestStatus === 'running') {
      connectWs();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [backtestId, backtestStatus, connectWs]);

  // Elapsed timer
  useEffect(() => {
    if (backtestStatus === 'running') {
      timerRef.current = setInterval(() => {
        setBacktestElapsed(useStore.getState().backtestElapsed + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [backtestStatus, setBacktestElapsed]);

  const handleStrategyChange = (e) => {
    const id = e.target.value;
    const strategy = strategies.find((s) => String(s.id) === String(id));
    setCurrentStrategy(strategy || null);
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        {/* Strategy Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Strategy</label>
          <div className="relative">
            <select
              className="select-field text-sm"
              value={currentStrategy?.id || ''}
              onChange={handleStrategyChange}
            >
              <option value="">Select strategy</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Date</label>
          <input
            type="date"
            className="input-field text-sm"
            value={backtestConfig.start_date}
            onChange={(e) => setBacktestConfig({ start_date: e.target.value })}
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">End Date</label>
          <input
            type="date"
            className="input-field text-sm"
            value={backtestConfig.end_date}
            onChange={(e) => setBacktestConfig({ end_date: e.target.value })}
          />
        </div>

        {/* Entry Time */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Entry Time</label>
          <input
            type="time"
            className="input-field text-sm"
            value={backtestConfig.entry_time}
            onChange={(e) => setBacktestConfig({ entry_time: e.target.value })}
          />
        </div>

        {/* Interval */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Interval</label>
          <div className="relative">
            <select
              className="select-field text-sm"
              value={backtestConfig.interval_minutes}
              onChange={(e) => setBacktestConfig({ interval_minutes: parseInt(e.target.value) })}
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="pt-2 border-t border-slate-700/50">
        <BacktestControls />
      </div>
    </div>
  );
}

export default BacktestRunner;
