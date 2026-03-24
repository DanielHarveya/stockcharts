import { Play, Pause, Square, Loader2, Clock } from 'lucide-react';
import useStore from '../store/useStore';

function BacktestControls() {
  const {
    backtestStatus, startBacktest, pauseBacktest, resumeBacktest, stopBacktest,
    backtestElapsed, backtestCurrentTimestamp, currentStrategy,
  } = useStore();

  const isIdle = backtestStatus === 'idle' || backtestStatus === 'stopped' || backtestStatus === 'completed';
  const isRunning = backtestStatus === 'running';
  const isPaused = backtestStatus === 'paused';

  const formatElapsed = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const statusConfig = {
    idle: { label: 'Idle', color: 'text-slate-400', bg: 'bg-slate-600/20' },
    running: { label: 'Running', color: 'text-emerald-400', bg: 'bg-emerald-600/20' },
    paused: { label: 'Paused', color: 'text-yellow-400', bg: 'bg-yellow-600/20' },
    completed: { label: 'Completed', color: 'text-indigo-400', bg: 'bg-indigo-600/20' },
    stopped: { label: 'Stopped', color: 'text-red-400', bg: 'bg-red-600/20' },
  };

  const status = statusConfig[backtestStatus] || statusConfig.idle;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        {/* Play / Resume */}
        <button
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${
            isIdle
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : isPaused
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
          onClick={isIdle ? startBacktest : isPaused ? resumeBacktest : undefined}
          disabled={isRunning || !currentStrategy}
          title={isIdle ? 'Start' : 'Resume'}
        >
          {isRunning ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>

        {/* Pause */}
        <button
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${
            isRunning
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
          onClick={isRunning ? pauseBacktest : undefined}
          disabled={!isRunning}
          title="Pause"
        >
          <Pause className="w-5 h-5" />
        </button>

        {/* Stop */}
        <button
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${
            isRunning || isPaused
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
          onClick={isRunning || isPaused ? stopBacktest : undefined}
          disabled={isIdle}
          title="Stop"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>

      {/* Status Badge */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${status.bg}`}>
        {isRunning && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />}
        <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
      </div>

      {/* Elapsed Time */}
      {(isRunning || isPaused) && (
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="w-4 h-4" />
          <span className="text-sm mono">{formatElapsed(backtestElapsed)}</span>
        </div>
      )}

      {/* Current Timestamp */}
      {backtestCurrentTimestamp && (isRunning || isPaused) && (
        <div className="text-xs text-slate-500 mono">
          Processing: {backtestCurrentTimestamp}
        </div>
      )}
    </div>
  );
}

export default BacktestControls;
