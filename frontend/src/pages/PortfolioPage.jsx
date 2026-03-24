import { Briefcase } from 'lucide-react';
import PortfolioDashboard from '../components/PortfolioDashboard';

function PortfolioPage() {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Portfolio Backtesting</h1>
            <p className="text-sm text-slate-400 mt-0.5">Run backtests across multiple strategies with combined analytics</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <PortfolioDashboard />
      </div>
    </div>
  );
}

export default PortfolioPage;
