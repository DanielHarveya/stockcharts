import { useState } from 'react';
import { BarChart3, Table2, Activity } from 'lucide-react';
import BacktestRunner from '../components/BacktestRunner';
import PLChart from '../components/PLChart';
import PLTable from '../components/PLTable';
import GreeksPanel from '../components/GreeksPanel';
import useStore from '../store/useStore';

function BacktestPage() {
  const [activeTab, setActiveTab] = useState('table');
  const backtestResults = useStore((s) => s.backtestResults);

  const tabs = [
    { id: 'table', label: 'P&L Table', icon: Table2 },
    { id: 'greeks', label: 'Greeks', icon: Activity },
  ];

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-white">Backtest</h1>
        <p className="text-sm text-slate-400 mt-1">Run and analyze strategy backtests</p>
      </div>

      {/* Config & Controls */}
      <div className="shrink-0">
        <BacktestRunner />
      </div>

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
        </div>
      </div>
    </div>
  );
}

export default BacktestPage;
