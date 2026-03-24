import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import useStore from '../store/useStore';

function MetricCard({ label, value, colorClass = 'text-white' }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold mono ${colorClass}`}>{value}</p>
    </div>
  );
}

function AnalyticsPanel() {
  const backtestAnalytics = useStore((s) => s.backtestAnalytics);
  const backtestStatus = useStore((s) => s.backtestStatus);
  const backtestCapital = useStore((s) => s.backtestCapital);
  const backtestResults = useStore((s) => s.backtestResults);
  const fetchAnalytics = useStore((s) => s.fetchAnalytics);
  const backtestId = useStore((s) => s.backtestId);

  useEffect(() => {
    if (backtestStatus === 'completed' && backtestId) {
      fetchAnalytics();
    }
  }, [backtestStatus, backtestId, fetchAnalytics]);

  // Build P&L distribution data from results
  const pnlDistribution = backtestResults.map((r, i) => {
    const prevPnl = i > 0 ? (backtestResults[i - 1].total_pnl ?? 0) : 0;
    const currentPnl = r.total_pnl ?? 0;
    const intervalPnl = currentPnl - prevPnl;
    return {
      time: formatTime(r.timestamp || ''),
      pnl: intervalPnl,
    };
  }).filter((_, i) => i > 0); // skip first since it has no previous

  if (!backtestId && backtestResults.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <p className="text-sm">Run a backtest to see analytics</p>
      </div>
    );
  }

  if (backtestStatus === 'running' && !backtestAnalytics) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
          <p className="text-sm">Calculating...</p>
        </div>
      </div>
    );
  }

  const a = backtestAnalytics || {};
  const cap = backtestCapital || {};

  const fmt = (v, decimals = 2) => {
    if (v == null || isNaN(v)) return '-';
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const pctFmt = (v) => {
    if (v == null || isNaN(v)) return '-';
    return Number(v).toFixed(2) + '%';
  };

  const pnlColor = (v) => {
    if (v == null) return 'text-white';
    return v >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Capital Summary Bar */}
      {(cap.initial_capital || backtestCapital) && (
        <div className="flex flex-wrap gap-4 p-3 bg-slate-800/40 rounded-lg border border-slate-700/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Capital:</span>
            <span className="text-sm mono text-white font-medium">{fmt(cap.current_capital || cap.initial_capital)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Used Margin:</span>
            <span className="text-sm mono text-slate-300">{fmt(cap.used_margin)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Free Capital:</span>
            <span className="text-sm mono text-slate-300">{fmt(cap.free_capital)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Drawdown:</span>
            <span className={`text-sm mono font-medium ${cap.drawdown_pct > 0 ? 'text-red-400' : 'text-slate-300'}`}>
              {pctFmt(cap.drawdown_pct)}
            </span>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={fetchAnalytics}
          disabled={!backtestId}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded border border-slate-700/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard label="Net P&L" value={fmt(a.net_pnl)} colorClass={pnlColor(a.net_pnl)} />
        <MetricCard label="Net P&L %" value={pctFmt(a.net_pnl_pct)} colorClass={pnlColor(a.net_pnl_pct)} />
        <MetricCard label="Max Profit" value={fmt(a.max_profit)} colorClass="text-emerald-400" />
        <MetricCard label="Max Loss" value={fmt(a.max_loss)} colorClass="text-red-400" />

        <MetricCard label="Win Rate" value={pctFmt(a.win_rate)} colorClass={a.win_rate >= 50 ? 'text-emerald-400' : 'text-amber-400'} />
        <MetricCard label="Sharpe Ratio" value={fmt(a.sharpe_ratio)} colorClass="text-white" />
        <MetricCard label="Profit Factor" value={fmt(a.profit_factor)} colorClass="text-white" />
        <MetricCard label="Risk/Reward" value={fmt(a.risk_reward)} colorClass="text-white" />

        <MetricCard label="Max Drawdown" value={fmt(a.max_drawdown)} colorClass="text-red-400" />
        <MetricCard label="Max Drawdown %" value={pctFmt(a.max_drawdown_pct)} colorClass="text-red-400" />
        <MetricCard label="Avg Win" value={fmt(a.avg_win)} colorClass="text-emerald-400" />
        <MetricCard label="Avg Loss" value={fmt(a.avg_loss)} colorClass="text-red-400" />

        <MetricCard label="Total Trades" value={a.total_trades ?? '-'} colorClass="text-white" />
        <MetricCard label="Win Count" value={a.win_count ?? '-'} colorClass="text-emerald-400" />
        <MetricCard label="Loss Count" value={a.loss_count ?? '-'} colorClass="text-red-400" />
      </div>

      {/* P&L Distribution Mini Chart */}
      {pnlDistribution.length > 1 && (
        <div className="bg-slate-800/40 rounded-lg border border-slate-700/30 p-4">
          <h4 className="text-sm font-semibold text-white mb-3">P&L Distribution</h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlDistribution} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.[0]) return null;
                    const val = payload[0].value;
                    return (
                      <div className="bg-slate-800 border border-slate-600 rounded px-3 py-2 shadow-xl">
                        <p className="text-xs text-slate-400 mono mb-1">{label}</p>
                        <p className={`text-sm mono font-medium ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {val >= 0 ? '+' : ''}{Number(val).toFixed(2)}
                        </p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                  {pnlDistribution.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.pnl >= 0 ? '#34d399' : '#f87171'}
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
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

export default AnalyticsPanel;
