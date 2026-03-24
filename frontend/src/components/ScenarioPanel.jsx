import { useState } from 'react';
import { Loader2, Play, Grid3X3, TrendingUp, TrendingDown } from 'lucide-react';
import { scenarioAPI } from '../api';
import useStore from '../store/useStore';

function ScenarioPanel() {
  const currentStrategy = useStore((s) => s.currentStrategy);

  const [spotChange, setSpotChange] = useState(0);
  const [ivChange, setIvChange] = useState(0);
  const [daysForward, setDaysForward] = useState(0);
  const [loading, setLoading] = useState(false);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [matrixData, setMatrixData] = useState(null);

  const handleRunScenario = async () => {
    if (!currentStrategy) {
      setError('Please select a strategy first (go to Strategy page).');
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await scenarioAPI.analyze({
        strategy_id: currentStrategy.id,
        spot_change: spotChange,
        iv_change: ivChange,
        days_forward: daysForward,
      });
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Scenario analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRunMatrix = async () => {
    if (!currentStrategy) {
      setError('Please select a strategy first (go to Strategy page).');
      return;
    }
    setMatrixLoading(true);
    setError(null);
    setMatrixData(null);
    try {
      const res = await scenarioAPI.matrix({
        strategy_id: currentStrategy.id,
        days_forward: daysForward,
      });
      setMatrixData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Matrix analysis failed');
    } finally {
      setMatrixLoading(false);
    }
  };

  const formatPnl = (value) => {
    if (value == null || isNaN(value)) return '-';
    const num = Number(value);
    return num >= 0
      ? `+${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getCellColor = (value) => {
    if (value == null || isNaN(value)) return 'bg-slate-800';
    const num = Number(value);
    if (num > 0) {
      const intensity = Math.min(num / 5000, 1);
      return `bg-emerald-${intensity > 0.6 ? '600' : intensity > 0.3 ? '700' : '800'}`;
    } else if (num < 0) {
      const intensity = Math.min(Math.abs(num) / 5000, 1);
      return `bg-red-${intensity > 0.6 ? '600' : intensity > 0.3 ? '700' : '800'}`;
    }
    return 'bg-slate-800';
  };

  const getCellStyle = (value) => {
    if (value == null || isNaN(value)) return {};
    const num = Number(value);
    if (num > 0) {
      const intensity = Math.min(num / 5000, 1);
      return {
        backgroundColor: `rgba(16, 185, 129, ${0.1 + intensity * 0.5})`,
        color: '#34d399',
      };
    } else if (num < 0) {
      const intensity = Math.min(Math.abs(num) / 5000, 1);
      return {
        backgroundColor: `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`,
        color: '#f87171',
      };
    }
    return { color: '#94a3b8' };
  };

  return (
    <div className="space-y-6">
      {/* Input Controls */}
      <div className="card p-6">
        <h3 className="text-md font-semibold text-white mb-4">Scenario Parameters</h3>
        {!currentStrategy && (
          <div className="text-amber-400 bg-amber-600/10 border border-amber-600/20 rounded-lg px-4 py-3 text-sm mb-4">
            No strategy selected. Go to the Strategy page to create or select one.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Spot Change */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Spot Change (pts): <span className="mono text-indigo-400">{spotChange > 0 ? '+' : ''}{spotChange}</span>
            </label>
            <input
              type="range"
              min="-1000"
              max="1000"
              step="10"
              value={spotChange}
              onChange={(e) => setSpotChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>-1000</span>
              <span>0</span>
              <span>+1000</span>
            </div>
          </div>

          {/* IV Change */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              IV Change (%): <span className="mono text-indigo-400">{ivChange > 0 ? '+' : ''}{ivChange}%</span>
            </label>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.5"
              value={ivChange}
              onChange={(e) => setIvChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>-20%</span>
              <span>0%</span>
              <span>+20%</span>
            </div>
          </div>

          {/* Days Forward */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Days Forward: <span className="mono text-indigo-400">{daysForward}</span>
            </label>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={daysForward}
              onChange={(e) => setDaysForward(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0</span>
              <span>15</span>
              <span>30</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleRunScenario}
            disabled={loading || !currentStrategy}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Scenario
          </button>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={handleRunMatrix}
            disabled={matrixLoading || !currentStrategy}
          >
            {matrixLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Grid3X3 className="w-4 h-4" />}
            Run Matrix
          </button>
        </div>
      </div>

      {error && (
        <div className="text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Scenario Results */}
      {results && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">Scenario Results</h3>

          {/* Per-leg results */}
          {results.legs && results.legs.length > 0 && (
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Leg</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-medium">Original Price</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-medium">Scenario Price</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-medium">Price Change</th>
                    <th className="text-right py-2 px-3 text-slate-400 font-medium">P&L Change</th>
                  </tr>
                </thead>
                <tbody>
                  {results.legs.map((leg, i) => {
                    const priceChange = (leg.scenario_price ?? 0) - (leg.original_price ?? 0);
                    return (
                      <tr key={i} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-slate-300">
                          {leg.symbol || leg.name || `Leg ${i + 1}`}
                        </td>
                        <td className="py-2 px-3 text-right mono text-slate-300">
                          {leg.original_price != null ? Number(leg.original_price).toFixed(2) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right mono text-slate-300">
                          {leg.scenario_price != null ? Number(leg.scenario_price).toFixed(2) : '-'}
                        </td>
                        <td className={`py-2 px-3 text-right mono font-medium ${
                          priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {formatPnl(priceChange)}
                        </td>
                        <td className={`py-2 px-3 text-right mono font-medium ${
                          (leg.pnl_change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {formatPnl(leg.pnl_change)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Total P&L Change */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/60 border border-slate-700/30">
            <span className="text-sm font-medium text-slate-300">Total P&L Change:</span>
            <span className={`text-lg mono font-bold ${
              (results.total_pnl_change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {(results.total_pnl_change ?? 0) >= 0 ? (
                <TrendingUp className="w-5 h-5 inline mr-1" />
              ) : (
                <TrendingDown className="w-5 h-5 inline mr-1" />
              )}
              {formatPnl(results.total_pnl_change)}
            </span>
          </div>
        </div>
      )}

      {/* Matrix Heatmap */}
      {matrixData && matrixData.matrix && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">Spot x IV Heatmap</h3>
          <p className="text-xs text-slate-400 mb-4">
            Rows: Spot price change (pts) | Columns: IV change (%)
          </p>

          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="py-1 px-2 text-slate-400 font-medium text-left">Spot \ IV</th>
                  {(matrixData.iv_range || []).map((iv, i) => (
                    <th key={i} className="py-1 px-2 text-slate-400 font-medium text-center mono min-w-[60px]">
                      {iv > 0 ? '+' : ''}{iv}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(matrixData.spot_range || []).map((spot, ri) => (
                  <tr key={ri}>
                    <td className="py-1 px-2 text-slate-400 font-medium mono">
                      {spot > 0 ? '+' : ''}{spot}
                    </td>
                    {(matrixData.matrix[ri] || []).map((val, ci) => (
                      <td
                        key={ci}
                        className="py-1 px-2 text-center mono font-medium rounded-sm"
                        style={getCellStyle(val)}
                      >
                        {val != null ? Number(val).toFixed(0) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(16, 185, 129, 0.5)' }} />
              Profit
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.5)' }} />
              Loss
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScenarioPanel;
