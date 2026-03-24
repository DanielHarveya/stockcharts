import StrategyBuilder from '../components/StrategyBuilder';

function StrategyPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Strategy Builder</h1>
        <p className="text-sm text-slate-400 mt-1">Create and manage multi-leg options strategies</p>
      </div>
      <StrategyBuilder />
    </div>
  );
}

export default StrategyPage;
