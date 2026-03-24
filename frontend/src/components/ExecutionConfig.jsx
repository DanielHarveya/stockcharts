import { useState } from 'react';
import { ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import useStore from '../store/useStore';

function ExecutionConfig() {
  const [expanded, setExpanded] = useState(false);
  const { backtestConfig, setBacktestConfig } = useStore();

  const execution = backtestConfig.execution || { slippage_model: 'none', slippage_value: 0 };
  const entryConditions = backtestConfig.entry_conditions || { condition_type: 'immediate', value: null };
  const exitConfig = backtestConfig.exit_config || { exit_time: '', dte_exit: null };
  const risk = backtestConfig.risk || { max_loss: null, max_drawdown: null, max_loss_per_leg: null };
  const capital = backtestConfig.capital || { initial_capital: 1000000 };

  const updateExecution = (updates) => {
    setBacktestConfig({ execution: { ...execution, ...updates } });
  };

  const updateEntryConditions = (updates) => {
    setBacktestConfig({ entry_conditions: { ...entryConditions, ...updates } });
  };

  const updateExitConfig = (updates) => {
    setBacktestConfig({ exit_config: { ...exitConfig, ...updates } });
  };

  const updateRisk = (updates) => {
    setBacktestConfig({ risk: { ...risk, ...updates } });
  };

  const updateCapital = (updates) => {
    setBacktestConfig({ capital: { ...capital, ...updates } });
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <Settings2 className="w-4 h-4" />
        <span className="font-medium">Advanced Settings</span>
      </button>

      {expanded && (
        <div className="mt-3 p-4 bg-slate-800/40 rounded-lg border border-slate-700/30 space-y-4">
          {/* Row 1: Slippage + Entry Conditions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Slippage Model */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Slippage Model</label>
              <div className="relative">
                <select
                  className="select-field text-sm"
                  value={execution.slippage_model}
                  onChange={(e) => updateExecution({ slippage_model: e.target.value, slippage_value: 0 })}
                >
                  <option value="none">None</option>
                  <option value="fixed_ticks">Fixed Ticks</option>
                  <option value="pct_price">% of Price</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Slippage Value */}
            {execution.slippage_model !== 'none' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Slippage Value {execution.slippage_model === 'pct_price' ? '(%)' : '(ticks)'}
                </label>
                <input
                  type="number"
                  className="input-field text-sm"
                  value={execution.slippage_value || ''}
                  onChange={(e) => updateExecution({ slippage_value: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step={execution.slippage_model === 'pct_price' ? '0.01' : '1'}
                  placeholder="0"
                />
              </div>
            )}

            {/* Entry Condition */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Entry Condition</label>
              <div className="relative">
                <select
                  className="select-field text-sm"
                  value={entryConditions.condition_type}
                  onChange={(e) => updateEntryConditions({ condition_type: e.target.value, value: null })}
                >
                  <option value="immediate">Immediate</option>
                  <option value="price_above">Price Above</option>
                  <option value="price_below">Price Below</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Entry Condition Value */}
            {entryConditions.condition_type !== 'immediate' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Condition Value</label>
                <input
                  type="number"
                  className="input-field text-sm"
                  value={entryConditions.value || ''}
                  onChange={(e) => updateEntryConditions({ value: parseFloat(e.target.value) || null })}
                  placeholder="Price level"
                />
              </div>
            )}
          </div>

          {/* Row 2: Exit + Risk + Capital */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Exit Time */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Exit Time (optional)</label>
              <input
                type="time"
                className="input-field text-sm"
                value={exitConfig.exit_time || ''}
                onChange={(e) => updateExitConfig({ exit_time: e.target.value })}
                placeholder="HH:MM"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Force exit at this time</p>
            </div>

            {/* Max Loss */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Loss</label>
              <input
                type="number"
                className="input-field text-sm"
                value={risk.max_loss || ''}
                onChange={(e) => updateRisk({ max_loss: parseFloat(e.target.value) || null })}
                placeholder="No limit"
                min="0"
              />
            </div>

            {/* Max Drawdown */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Drawdown</label>
              <input
                type="number"
                className="input-field text-sm"
                value={risk.max_drawdown || ''}
                onChange={(e) => updateRisk({ max_drawdown: parseFloat(e.target.value) || null })}
                placeholder="No limit"
                min="0"
              />
            </div>

            {/* Max Loss Per Leg */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Loss / Leg</label>
              <input
                type="number"
                className="input-field text-sm"
                value={risk.max_loss_per_leg || ''}
                onChange={(e) => updateRisk({ max_loss_per_leg: parseFloat(e.target.value) || null })}
                placeholder="No limit"
                min="0"
              />
            </div>

            {/* Initial Capital */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Initial Capital</label>
              <input
                type="number"
                className="input-field text-sm"
                value={capital.initial_capital || ''}
                onChange={(e) => updateCapital({ initial_capital: parseFloat(e.target.value) || 1000000 })}
                placeholder="1000000"
                min="0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExecutionConfig;
