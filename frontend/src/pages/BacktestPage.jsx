import { useState } from 'react';
import { BarChart3, Table2, Activity, TrendingUp, ScrollText, Download } from 'lucide-react';
import BacktestRunner from '../components/BacktestRunner';
import PLChart from '../components/PLChart';
import PLTable from '../components/PLTable';
import GreeksPanel from '../components/GreeksPanel';
import AnalyticsPanel from '../components/AnalyticsPanel';
import EventLog from '../components/EventLog';
import useStore from '../store/useStore';

function BacktestPage() {
  const [activeTab, setActiveTab] = useState('table');
  const backtestResults = useStore((s) => s.backtestResults);
  const backtestCapital = useStore((s) => s.backtestCapital);
  const exportCsv = useStore((s) => s.exportCsv);
  const backtestId = useStore((s) => s.backtestId);

  const tabs = [
    { id: 'table', label: 'P&L Table', icon: Table2 },
    { id: 'greeks', label: 'Greeks', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'events', label: 'Event Log', icon: ScrollText },
  ];

  const cap = backtestCapital || {};

  const fmtNum = (v) => {
    if (v == null || isNaN(v)) return '-';
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Backtest</h1>
          <p className="text-sm text-slate-400 mt-1">Run and analyze strategy backtests</p>
        </div>
        {backtestId && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Config & Controls */}
      <div className="shrink-0">
        <BacktestRunner />
      </div>

      {/* Capital Summary Bar */}
      {backtestCapital && (
        <div className="shrink-0 flex flex-wrap gap-6 px-5 py-3 bg-slate-800/40 rounded-lg border border-slate-700/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Capital:</span>
            <span className="text-sm mono text-white font-semibold">{fmtNum(cap.current_capital || cap.initial_capital)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Used Margin:</span>
            <span className="text-sm mono text-slate-300">{fmtNum(cap.used_margin)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Free Capital:</span>
            <span className="text-sm mono text-slate-300">{fmtNum(cap.free_capital)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Drawdown:</span>
            <span className={`text-sm mono font-medium ${cap.drawdown_pct > 0 ? 'text-red-400' : 'text-slate-300'}`}>
              {cap.drawdown_pct != null ? Number(cap.drawdown_pct).toFixed(2) + '%' : '-'}
            </span>
          </div>
        </div>
      )}

      {/* Chart area - 60% */}
      <div className="card flex-[6] min-h-0 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">P&L Chart</h3>
          {backtestResults.length > 0 && (
            <span className="text-xs text-slate-500 mono ml-auto">
              {backtestResults.length} data points
            </span>
          )}
        </div>
        <div className="h-[calc(100%-2rem)]">
          <PLChart />
        </div>
      </div>

      {/* Bottom tabs area - 40% */}
      <div className="card flex-[4] min-h-0 flex flex-col">
        {/* Tab headers */}
        <div className="flex border-b border-slate-700/50 shrink-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                activeTab === id
                  ? 'text-indigo-400 border-indigo-400 bg-indigo-600/5'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50'
              }`}
              onClick={() => setActiveTab(id)}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'table' && <PLTable />}
          {activeTab === 'greeks' && <GreeksPanel />}
          {activeTab === 'analytics' && <AnalyticsPanel />}
          {activeTab === 'events' && <EventLog />}
        </div>
      </div>
    </div>
  );
}

export default BacktestPage;
