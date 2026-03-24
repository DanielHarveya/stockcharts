import { useState, useMemo } from 'react';
import { Loader2, Play, Zap, AlertTriangle, Trophy } from 'lucide-react';
import { optimizerAPI } from '../api';
import useStore from '../store/useStore';

function OptimizerPanel() {
  const strategies = useStore((s) => s.strategies);
  const currentStrategy = useStore((s) => s.currentStrategy);

  const [strategyId, setStrategyId] = useState(currentStrategy?.id || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [slRange, setSlRange] = useState('10,20,30,40,50');
  const [targetRange, setTargetRange] = useState('20,40,60,80,100');
  const [trailingSLRange, setTrailingSLRange] = useState('5,10,15,20');
  const [entryTimeRange, setEntryTimeRange] = useState('09:20,09:30,09:45,10:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const parseRange = (str) => {
    return str.split(',').map((s) => s.trim()).filter((s) => s !== '');
  };

  const totalCombinations = useMemo(() => {
    const sl = parseRange(slRange).length || 1;
    const target = parseRange(targetRange).length || 1;
    const trailing = parseRange(trailingSLRange).length || 1;
    const entry = parseRange(entryTimeRange).length || 1;
    return sl * target * trailing * entry;
  }, [slRange, targetRange, trailingSLRange, entryTimeRange]);

  const handleRun = async () => {
    if (!strategyId) {
      setError('Please select a strategy');
      return;
    }
    if (!startDate || !endDate) {
      setError('Start and end dates are required');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await optimizerAPI.run({
        strategy_id: strategyId,
        start_date: startDate,
        end_date: endDate,
        sl_range: parseRange(slRange).map(Number).filter((n) => !isNaN(n)),
        target_range: parseRange(targetRange).map(Number).filter((n) => !isNaN(n)),
        trailing_sl_range: parseRange(trailingSLRange).map(Number).filter((n) => !isNaN(n)),
        entry_time_range: parseRange(entryTimeRange),
      });
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Optimization failed');
    } finally {
      setLoading(false);
    }
  };

  const sortedResults = useMemo(() => {
    if (!results?.results) return [];
    return [...results.results].sort((a, b) => (b.sharpe_ratio ?? -999) - (a.sharpe_ratio ?? -999));
  }, [results]);

  const warnings = results?.warnings || [];
  const topResult = sortedResults.length > 0 ? sortedResults[0] : null;

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-5 h-5 text-indigo-400" />
          <h3 className="text-md font-semibold text-white">Parameter Optimizer</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Strategy</label>
            <select
              className="input-field"
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
            >
              <option value="">Select strategy...</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date</label>
            <input
              type="date"
              className="input-field"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">End Date</label>
            <input
              type="date"
              className="input-field"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">SL Range (comma-separated)</label>
            <input
              type="text"
              className="input-field mono"
              placeholder="10,20,30,40,50"
              value={slRange}
              onChange={(e) => setSlRange(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">{parseRange(slRange).length} values</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Target Range (comma-separated)</label>
            <input
              type="text"
              className="input-field mono"
              placeholder="20,40,60,80,100"
              value={targetRange}
              onChange={(e) => setTargetRange(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">{parseRange(targetRange).length} values</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Trailing SL Range (comma-separated)</label>
            <input
              type="text"
              className="input-field mono"
              placeholder="5,10,15,20"
              value={trailingSLRange}
              onChange={(e) => setTrailingSLRange(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">{parseRange(trailingSLRange).length} values</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Entry Time Range (comma-separated)</label>
            <input
              type="text"
              className="input-field mono"
              placeholder="09:20,09:30,09:45,10:00"
              value={entryTimeRange}
              onChange={(e) => setEntryTimeRange(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">{parseRange(entryTimeRange).length} values</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleRun}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {loading ? 'Optimizing...' : 'Run Optimizer'}
          </button>

          <div className={`text-sm mono ${totalCombinations > 500 ? 'text-amber-400' : 'text-slate-400'}`}>
            {totalCombinations > 500 && <AlertTriangle className="w-4 h-4 inline mr-1" />}
            {totalCombinations.toLocaleString()} combinations
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-amber-400 bg-amber-600/10 border border-amber-600/20 rounded-lg px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top Result Highlight */}
      {topResult && (
        <div className="card p-6 border-indigo-500/30 bg-indigo-600/5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-md font-semibold text-white">Best Configuration</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">SL</div>
              <div className="text-sm mono font-semibold text-white">{topResult.sl ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Target</div>
              <div className="text-sm mono font-semibold text-white">{topResult.target ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Trailing SL</div>
              <div className="text-sm mono font-semibold text-white">{topResult.trailing_sl ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Entry Time</div>
              <div className="text-sm mono font-semibold text-white">{topResult.entry_time ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Net P&L</div>
              <div className={`text-sm mono font-semibold ${
                (topResult.net_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {topResult.net_pnl != null
                  ? Number(topResult.net_pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Sharpe</div>
              <div className="text-sm mono font-semibold text-indigo-400">
                {topResult.sharpe_ratio != null ? Number(topResult.sharpe_ratio).toFixed(2) : '-'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {sortedResults.length > 0 && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">
            All Results ({sortedResults.length} configurations, sorted by Sharpe)
          </h3>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="border-b border-slate-700/50">
                  <th className="text-center py-2 px-2 text-slate-400 font-medium w-8">#</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">SL</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Target</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Trail SL</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Entry</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Net P&L</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Sharpe</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Max DD</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Win Rate</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Trades</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r, i) => {
                  const isTop = i === 0;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-slate-700/20 hover:bg-slate-800/30 ${
                        isTop ? 'bg-indigo-600/5' : ''
                      }`}
                    >
                      <td className="py-2 px-2 text-center text-slate-500 text-xs">
                        {isTop ? <Trophy className="w-3.5 h-3.5 text-amber-400 mx-auto" /> : i + 1}
                      </td>
                      <td className="py-2 px-3 text-right mono text-slate-300">{r.sl ?? '-'}</td>
                      <td className="py-2 px-3 text-right mono text-slate-300">{r.target ?? '-'}</td>
                      <td className="py-2 px-3 text-right mono text-slate-300">{r.trailing_sl ?? '-'}</td>
                      <td className="py-2 px-3 mono text-slate-300">{r.entry_time ?? '-'}</td>
                      <td className={`py-2 px-3 text-right mono font-medium ${
                        (r.net_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {r.net_pnl != null
                          ? Number(r.net_pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '-'}
                      </td>
                      <td className="py-2 px-3 text-right mono text-indigo-400 font-medium">
                        {r.sharpe_ratio != null ? Number(r.sharpe_ratio).toFixed(2) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right mono text-red-400">
                        {r.max_drawdown != null
                          ? Number(r.max_drawdown).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '-'}
                      </td>
                      <td className="py-2 px-3 text-right mono text-slate-300">
                        {r.win_rate != null ? `${Number(r.win_rate).toFixed(1)}%` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right mono text-slate-300">{r.total_trades ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default OptimizerPanel;
