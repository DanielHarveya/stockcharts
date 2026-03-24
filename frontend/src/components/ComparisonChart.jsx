import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';
import { Loader2, BarChart3 } from 'lucide-react';
import { historyAPI } from '../api';

const COMPARISON_COLORS = [
  '#818cf8', '#34d399', '#f87171', '#fbbf24', '#a78bfa',
  '#22d3ee', '#fb923c', '#e879f9', '#4ade80', '#f472b6',
];

function ComparisonChart({ selectedIds }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedIds || selectedIds.length < 2) {
      setResults(null);
      return;
    }

    const fetchComparison = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await historyAPI.compare(selectedIds);
        setResults(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Failed to load comparison');
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [selectedIds]);

  const { chartData, backtestNames } = useMemo(() => {
    if (!results || !results.backtests) return { chartData: [], backtestNames: [] };

    const names = results.backtests.map((bt) => bt.name || bt.strategy_name || bt.id);
    const allTimestamps = new Set();

    results.backtests.forEach((bt) => {
      if (bt.results) {
        bt.results.forEach((r) => {
          allTimestamps.add(r.timestamp || r.time || '');
        });
      }
    });

    const sortedTimestamps = Array.from(allTimestamps).sort();

    const data = sortedTimestamps.map((ts) => {
      const point = {
        time: ts,
        displayTime: formatTime(ts),
      };

      results.backtests.forEach((bt, i) => {
        const key = `bt_${i}`;
        const match = bt.results?.find((r) => (r.timestamp || r.time) === ts);
        if (match) {
          point[key] = match.total_pnl ?? match.total ?? 0;
        }
      });

      return point;
    });

    return { chartData: data, backtestNames: names };
  }, [results]);

  if (!selectedIds || selectedIds.length < 2) {
    return null;
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          <span className="ml-3 text-slate-400">Loading comparison data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!results || chartData.length === 0) {
    return null;
  }

  const analytics = results.backtests?.map((bt) => bt.analytics || {}) || [];

  return (
    <div className="space-y-4">
      {/* Comparison Chart */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <h3 className="text-md font-semibold text-white">P&L Comparison</h3>
          <span className="text-xs text-slate-500 ml-auto">{backtestNames.length} backtests</span>
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
              <Tooltip content={<ComparisonTooltip names={backtestNames} />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
                iconType="line"
              />
              {backtestNames.map((name, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`bt_${i}`}
                  name={name}
                  stroke={COMPARISON_COLORS[i % COMPARISON_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Table */}
      {analytics.length > 0 && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">Side-by-Side Analytics</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Metric</th>
                  {backtestNames.map((name, i) => (
                    <th key={i} className="text-right py-2 px-3 font-medium" style={{ color: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }}>
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Net P&L', key: 'net_pnl', format: 'currency' },
                  { label: 'Total Trades', key: 'total_trades', format: 'number' },
                  { label: 'Win Rate', key: 'win_rate', format: 'percent' },
                  { label: 'Sharpe Ratio', key: 'sharpe_ratio', format: 'decimal' },
                  { label: 'Max Drawdown', key: 'max_drawdown', format: 'currency' },
                  { label: 'Max Drawdown %', key: 'max_drawdown_pct', format: 'percent' },
                  { label: 'Profit Factor', key: 'profit_factor', format: 'decimal' },
                  { label: 'Avg Win', key: 'avg_win', format: 'currency' },
                  { label: 'Avg Loss', key: 'avg_loss', format: 'currency' },
                ].map((metric) => (
                  <tr key={metric.key} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                    <td className="py-2 px-3 text-slate-300">{metric.label}</td>
                    {analytics.map((a, i) => {
                      const val = a[metric.key];
                      let display = '-';
                      let colorClass = 'text-slate-300';

                      if (val != null && !isNaN(val)) {
                        if (metric.format === 'currency') {
                          display = Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          colorClass = val >= 0 ? 'text-emerald-400' : 'text-red-400';
                        } else if (metric.format === 'percent') {
                          display = `${Number(val).toFixed(2)}%`;
                        } else if (metric.format === 'decimal') {
                          display = Number(val).toFixed(2);
                        } else {
                          display = String(val);
                        }
                      }

                      return (
                        <td key={i} className={`py-2 px-3 text-right mono ${colorClass}`}>
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonTooltip({ active, payload, label, names }) {
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

export default ComparisonChart;
