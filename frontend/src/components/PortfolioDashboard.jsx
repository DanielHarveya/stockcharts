import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { Loader2, Play, Briefcase, CheckSquare, Square } from 'lucide-react';
import { portfolioAPI } from '../api';
import useStore from '../store/useStore';

const STRATEGY_COLORS = [
  '#818cf8', '#34d399', '#f87171', '#fbbf24', '#a78bfa',
  '#22d3ee', '#fb923c', '#e879f9', '#4ade80', '#f472b6',
];

function PortfolioDashboard() {
  const strategies = useStore((s) => s.strategies);
  const loadStrategies = useStore((s) => s.loadStrategies);

  const [selectedStrategies, setSelectedStrategies] = useState(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entryTime, setEntryTime] = useState('09:20');
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [pollingId, setPollingId] = useState(null);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  useEffect(() => {
    if (!pollingId) return;

    const interval = setInterval(async () => {
      try {
        const statusRes = await portfolioAPI.status(pollingId);
        if (statusRes.data.status === 'completed') {
          clearInterval(interval);
          const resultsRes = await portfolioAPI.results(pollingId);
          const analyticsRes = await portfolioAPI.analytics(pollingId);
          setResults({
            strategies: resultsRes.data.strategies || resultsRes.data || [],
            analytics: analyticsRes.data || {},
          });
          setLoading(false);
          setPollingId(null);
        } else if (statusRes.data.status === 'failed') {
          clearInterval(interval);
          setError(statusRes.data.error || 'Portfolio backtest failed');
          setLoading(false);
          setPollingId(null);
        }
      } catch (err) {
        clearInterval(interval);
        setError(err.response?.data?.detail || err.message || 'Failed to check status');
        setLoading(false);
        setPollingId(null);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pollingId]);

  const toggleStrategy = (id) => {
    setSelectedStrategies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRun = async () => {
    if (selectedStrategies.size === 0) {
      setError('Select at least one strategy');
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
      const res = await portfolioAPI.run({
        strategy_ids: Array.from(selectedStrategies),
        start_date: startDate,
        end_date: endDate,
        entry_time: entryTime,
        initial_capital: initialCapital,
      });

      if (res.data.portfolio_id || res.data.id) {
        setPollingId(res.data.portfolio_id || res.data.id);
      } else if (res.data.strategies || res.data.results) {
        setResults({
          strategies: res.data.strategies || res.data.results || [],
          analytics: res.data.analytics || {},
        });
        setLoading(false);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to run portfolio backtest');
      setLoading(false);
    }
  };

  const { chartData, strategyNames } = useMemo(() => {
    if (!results || !results.strategies || results.strategies.length === 0) {
      return { chartData: [], strategyNames: [] };
    }

    const names = results.strategies.map((s) => s.name || s.strategy_name || 'Strategy');
    const allTimestamps = new Set();

    results.strategies.forEach((s) => {
      if (s.results) {
        s.results.forEach((r) => allTimestamps.add(r.timestamp || r.time || ''));
      }
    });

    const sorted = Array.from(allTimestamps).sort();
    const data = sorted.map((ts) => {
      const point = {
        time: ts,
        displayTime: formatTime(ts),
        total: 0,
      };

      results.strategies.forEach((s, i) => {
        const key = `strat_${i}`;
        const match = s.results?.find((r) => (r.timestamp || r.time) === ts);
        if (match) {
          const pnl = match.total_pnl ?? match.total ?? 0;
          point[key] = pnl;
          point.total += pnl;
        }
      });

      return point;
    });

    return { chartData: data, strategyNames: names };
  }, [results]);

  const greeks = results?.analytics?.combined_greeks || null;

  return (
    <div className="space-y-6">
      {/* Strategy Selection */}
      <div className="card p-6">
        <h3 className="text-md font-semibold text-white mb-4">Select Strategies</h3>

        {strategies.length === 0 ? (
          <p className="text-sm text-slate-500">No strategies found. Create strategies on the Strategy page first.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
            {strategies.map((s) => {
              const isSelected = selectedStrategies.has(s.id);
              return (
                <button
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500/50 bg-indigo-600/10'
                      : 'border-slate-700/30 bg-slate-800/40 hover:border-slate-600/50'
                  }`}
                  onClick={() => toggleStrategy(s.id)}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-white block truncate">{s.name}</span>
                    <span className="text-xs text-slate-500">{s.legs?.length || 0} legs</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Config */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Entry Time</label>
            <input
              type="time"
              className="input-field mono"
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Initial Capital</label>
            <input
              type="number"
              className="input-field mono"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
            />
          </div>
        </div>

        <button
          className="btn-primary flex items-center gap-2"
          onClick={handleRun}
          disabled={loading || selectedStrategies.size === 0}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? 'Running...' : 'Run Portfolio Backtest'}
        </button>
      </div>

      {error && (
        <div className="text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Combined P&L Chart */}
      {chartData.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            <h3 className="text-md font-semibold text-white">Portfolio P&L</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="displayTime"
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <Tooltip content={<PortfolioTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} iconType="line" />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />

                {strategyNames.map((name, i) => (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`strat_${i}`}
                    name={name}
                    stroke={STRATEGY_COLORS[i % STRATEGY_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}

                <Line
                  type="monotone"
                  dataKey="total"
                  name="Portfolio Total"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Analytics Table */}
      {results && results.strategies && results.strategies.length > 0 && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">Combined Analytics</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Strategy</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Net P&L</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Trades</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Win Rate</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Sharpe</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {results.strategies.map((s, i) => {
                  const a = s.analytics || {};
                  const pnl = a.net_pnl ?? a.total_pnl ?? 0;
                  return (
                    <tr key={i} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }} />
                          <span className="text-slate-300">{s.name || s.strategy_name || `Strategy ${i + 1}`}</span>
                        </div>
                      </td>
                      <td className={`py-2 px-3 text-right mono font-medium ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {Number(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right mono text-slate-300">{a.total_trades ?? '-'}</td>
                      <td className="py-2 px-3 text-right mono text-slate-300">
                        {a.win_rate != null ? `${Number(a.win_rate).toFixed(1)}%` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right mono text-slate-300">
                        {a.sharpe_ratio != null ? Number(a.sharpe_ratio).toFixed(2) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right mono text-red-400">
                        {a.max_drawdown != null ? Number(a.max_drawdown).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                    </tr>
                  );
                })}
                {/* Portfolio total row */}
                {results.analytics && (
                  <tr className="border-t-2 border-slate-600 bg-slate-800/40">
                    <td className="py-2 px-3 font-semibold text-white">Portfolio Total</td>
                    <td className={`py-2 px-3 text-right mono font-bold ${
                      (results.analytics.net_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {Number(results.analytics.net_pnl ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-right mono text-white">{results.analytics.total_trades ?? '-'}</td>
                    <td className="py-2 px-3 text-right mono text-white">
                      {results.analytics.win_rate != null ? `${Number(results.analytics.win_rate).toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-2 px-3 text-right mono text-white">
                      {results.analytics.sharpe_ratio != null ? Number(results.analytics.sharpe_ratio).toFixed(2) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right mono text-red-400">
                      {results.analytics.max_drawdown != null ? Number(results.analytics.max_drawdown).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Combined Greeks */}
      {greeks && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">Combined Greeks</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Delta', value: greeks.delta, color: 'text-blue-400' },
              { label: 'Gamma', value: greeks.gamma, color: 'text-purple-400' },
              { label: 'Theta', value: greeks.theta, color: 'text-amber-400' },
              { label: 'Vega', value: greeks.vega, color: 'text-cyan-400' },
              { label: 'Rho', value: greeks.rho, color: 'text-pink-400' },
            ].map((g) => (
              <div key={g.label} className="p-4 bg-slate-800/60 rounded-lg border border-slate-700/30 text-center">
                <div className="text-xs text-slate-400 mb-1">{g.label}</div>
                <div className={`text-lg mono font-semibold ${g.color}`}>
                  {g.value != null ? Number(g.value).toFixed(4) : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-2 mono">{label}</p>
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
              {entry.value >= 0 ? '+' : ''}{Number(entry.value).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return String(timestamp).slice(-8);
  }
}

export default PortfolioDashboard;
