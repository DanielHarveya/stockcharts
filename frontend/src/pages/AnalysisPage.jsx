import { useState } from 'react';
import { FlaskConical, Activity, Shuffle, Zap } from 'lucide-react';
import ScenarioPanel from '../components/ScenarioPanel';
import IVSurface from '../components/IVSurface';
import WalkForwardPanel from '../components/WalkForwardPanel';
import OptimizerPanel from '../components/OptimizerPanel';

const tabs = [
  { id: 'scenario', label: 'Scenario What-If', icon: FlaskConical },
  { id: 'iv', label: 'IV Surface', icon: Activity },
  { id: 'walkforward', label: 'Walk-Forward', icon: Shuffle },
  { id: 'optimizer', label: 'Optimizer', icon: Zap },
];

function AnalysisPage() {
  const [activeTab, setActiveTab] = useState('scenario');

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-white">Analysis Tools</h1>
        <p className="text-sm text-slate-400 mt-1">Advanced analysis, optimization, and scenario modeling</p>
      </div>

      {/* Tab headers */}
      <div className="shrink-0 flex border-b border-slate-700/50 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
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
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'scenario' && <ScenarioPanel />}
        {activeTab === 'iv' && <IVSurface />}
        {activeTab === 'walkforward' && <WalkForwardPanel />}
        {activeTab === 'optimizer' && <OptimizerPanel />}
      </div>
    </div>
  );
}

export default AnalysisPage;
