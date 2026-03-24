import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';
import { Loader2, Play, Shuffle } from 'lucide-react';
import { walkforwardAPI } from '../api';
import useStore from '../store/useStore';

function WalkForwardPanel() {
  const strategies = useStore((s) => s.strategies);
  const currentStrategy = useStore((s) => s.currentStrategy);

  const [strategyId, setStrategyId] = useState(currentStrategy?.id || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [inSampleDays, setInSampleDays] = useState(30);
  const [outOfSampleDays, setOutOfSampleDays] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

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
      const res = await walkforwardAPI.run({
        strategy_id: strategyId,
        start_date: startDate,
        end_date: endDate,
        in_sample_days: inSampleDays,
        out_of_sample_days: outOfSampleDays,
      });
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Walk-forward analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const windows = results?.windows || [];
  const summary = results?.summary || {};

  const chartData = windows.map((w, i) => ({
    name: `W${i + 1}`,
    in_sample: w.in_sample_pnl ?? 0,
    out_of_sample: w.out_of_sample_pnl ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shuffle className="w-5 h-5 text-indigo-400" />
          <h3 className="text-md font-semibold text-white">Walk-Forward Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
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
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">In-Sample Days</label>
            <input
              type="number"
              className="input-field mono"
              min="5"
              value={inSampleDays}
              onChange={(e) => setInSampleDays(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Out-of-Sample Days</label>
            <input
              type="number"
              className="input-field mono"
              min="1"
              value={outOfSampleDays}
              onChange={(e) => setOutOfSampleDays(Number(e.target.value))}
            />
          </div>
        </div>

        <button
          className="btn-primary flex items-center gap-2"
          onClick={handleRun}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? 'Running...' : 'Run Walk-Forward Analysis'}
        </button>
      </div>

      {error && (
        <div className="text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Summary */}
      {results && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700/30 text-center">
              <div className="text-xs text-slate-400 mb-1">Windows</div>
              <div className="text-lg mono font-semibold text-white">{windows.length}</div>
            </div>
            <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700/30 text-center">
              <div className="text-xs text-slate-400 mb-1">Robustness Score</div>
              <div className={`text-lg mono font-semibold ${
                (summary.robustness_score ?? 0) >= 0.7 ? 'text-emerald-400' :
                (summary.robustness_score ?? 0) >= 0.4 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {summary.robustness_score != null ? `${(summary.robustness_score * 100).toFixed(1)}%` : '-'}
              </div>
            </div>
            <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700/30 text-center">
              <div className="text-xs text-slate-400 mb-1">Consistency</div>
              <div className={`text-lg mono font-semibold ${
                (summary.consistency_pct ?? 0) >= 70 ? 'text-emerald-400' :
                (summary.consistency_pct ?? 0) >= 40 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {summary.consistency_pct != null ? `${Number(summary.consistency_pct).toFixed(1)}%` : '-'}
              </div>
            </div>
            <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700/30 text-center">
              <div className="text-xs text-slate-400 mb-1">OOS Total P&L</div>
              <div className={`text-lg mono font-semibold ${
                (summary.total_oos_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {summary.total_oos_pnl != null
                  ? Number(summary.total_oos_pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : '-'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">In-Sample vs Out-of-Sample P&L</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <Tooltip content={<WFTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                <Bar dataKey="in_sample" name="In-Sample P&L" fill="#818cf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out_of_sample" name="Out-of-Sample P&L" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Windows Table */}
      {windows.length > 0 && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">Window Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Window</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">IS Period</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">OOS Period</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">IS P&L</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">OOS P&L</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">IS Sharpe</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">OOS Sharpe</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Consistent</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((w, i) => {
                  const isConsistent = (w.in_sample_pnl ?? 0) > 0 && (w.out_of_sample_pnl ?? 0) > 0;
                  return (
                    <tr key={i} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-300 font-medium">W{i + 1}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs mono">
                        {w.in_sample_start || '-'} to {w.in_sample_end || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs mono">
                        {w.out_of_sample_start || '-'} to {w.out_of_sample_end || '-'}
                      </td>
                      <td className={`py-2 px-3 text-right mono font-medium ${
                        (w.in_sample_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {w.in_sample_pnl != null ? Number(w.in_sample_pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className={`py-2 px-3 text-right mono font-medium ${
                        (w.out_of_sample_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {w.out_of_sample_pnl != null ? Number(w.out_of_sample_pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right mono text-slate-300">
                        {w.in_sample_sharpe != null ? Number(w.in_sample_sharpe).toFixed(2) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right mono text-slate-300">
                        {w.out_of_sample_sharpe != null ? Number(w.out_of_sample_sharpe).toFixed(2) : '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isConsistent ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                        }`}>
                          {isConsistent ? 'Yes' : 'No'}
                        </span>
                      </td>
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

function WFTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-slate-300">{entry.name}</span>
            </div>
            <span className={`text-xs mono font-medium ${
              entry.value >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WalkForwardPanel;
