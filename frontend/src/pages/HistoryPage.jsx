import { useState } from 'react';
import { Clock } from 'lucide-react';
import BacktestHistory from '../components/BacktestHistory';
import ComparisonChart from '../components/ComparisonChart';

function HistoryPage() {
  const [compareIds, setCompareIds] = useState(null);
  const [viewedResult, setViewedResult] = useState(null);

  const handleCompare = (ids) => {
    setCompareIds(ids);
    setViewedResult(null);
  };

  const handleViewResult = (result) => {
    setViewedResult(result);
    setCompareIds(null);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Backtest History</h1>
            <p className="text-sm text-slate-400 mt-0.5">View, compare, and manage your past backtests</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-6">
        <BacktestHistory onCompare={handleCompare} onViewResult={handleViewResult} />

        {/* Comparison Chart */}
        {compareIds && compareIds.length >= 2 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Comparison</h2>
              <button
                className="btn-secondary text-sm"
                onClick={() => setCompareIds(null)}
              >
                Close Comparison
              </button>
            </div>
            <ComparisonChart selectedIds={compareIds} />
          </div>
        )}

        {/* Viewed Result Detail */}
        {viewedResult && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                {viewedResult.name || viewedResult.strategy_name || 'Backtest Detail'}
              </h2>
              <button
                className="btn-secondary text-sm"
                onClick={() => setViewedResult(null)}
              >
                Close
              </button>
            </div>

            {/* Config summary */}
            {(viewedResult.config || viewedResult.start_date) && (
              <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-400">
                {(viewedResult.config?.start_date || viewedResult.start_date) && (
                  <span>Start: <span className="mono text-slate-300">{viewedResult.config?.start_date || viewedResult.start_date}</span></span>
                )}
                {(viewedResult.config?.end_date || viewedResult.end_date) && (
                  <span>End: <span className="mono text-slate-300">{viewedResult.config?.end_date || viewedResult.end_date}</span></span>
                )}
                {(viewedResult.config?.entry_time || viewedResult.entry_time) && (
                  <span>Entry: <span className="mono text-slate-300">{viewedResult.config?.entry_time || viewedResult.entry_time}</span></span>
                )}
              </div>
            )}

            {/* Analytics */}
            {viewedResult.analytics && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                {[
                  { label: 'Net P&L', key: 'net_pnl', colored: true },
                  { label: 'Total Trades', key: 'total_trades' },
                  { label: 'Win Rate', key: 'win_rate', suffix: '%' },
                  { label: 'Sharpe', key: 'sharpe_ratio' },
                  { label: 'Max DD', key: 'max_drawdown', colored: true },
                  { label: 'Profit Factor', key: 'profit_factor' },
                ].map((m) => {
                  const val = viewedResult.analytics[m.key];
                  return (
                    <div key={m.key} className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/30">
                      <div className="text-xs text-slate-400 mb-1">{m.label}</div>
                      <div className={`text-sm mono font-semibold ${
                        m.colored && val != null
                          ? (m.key === 'max_drawdown' ? 'text-red-400' : val >= 0 ? 'text-emerald-400' : 'text-red-400')
                          : 'text-white'
                      }`}>
                        {val != null
                          ? `${typeof val === 'number' ? Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val}${m.suffix || ''}`
                          : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Results preview */}
            {viewedResult.results && viewedResult.results.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  Results ({viewedResult.results.length} data points)
                </h3>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="border-b border-slate-700/50">
                        <th className="text-left py-1.5 px-2 text-slate-400 font-medium">Time</th>
                        <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Total P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewedResult.results.slice(0, 100).map((r, i) => (
                        <tr key={i} className="border-b border-slate-700/10">
                          <td className="py-1 px-2 mono text-slate-400">{r.timestamp || r.time || '-'}</td>
                          <td className={`py-1 px-2 text-right mono font-medium ${
                            (r.total_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {r.total_pnl != null ? Number(r.total_pnl).toFixed(2) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {viewedResult.results.length > 100 && (
                    <p className="text-xs text-slate-500 mt-2 px-2">
                      Showing first 100 of {viewedResult.results.length} data points
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
