import { X, TrendingUp, TrendingDown } from 'lucide-react';
import InstrumentSearch from './InstrumentSearch';

function LegCard({ leg, index, onChange, onRemove }) {
  const isBuy = leg.action === 'BUY';

  const handleFieldChange = (field, value) => {
    onChange(index, { ...leg, [field]: value });
  };

  const handleInstrumentSelect = (instrument) => {
    if (!instrument) {
      onChange(index, {
        ...leg,
        instrument: null,
        symbol: '',
        exchange: '',
        expiry: '',
        strike: '',
        option_type: '',
        lot_size: '',
        instrument_token: '',
      });
      return;
    }
    onChange(index, {
      ...leg,
      instrument,
      symbol: instrument.symbol || instrument.tradingsymbol || '',
      exchange: instrument.exchange || '',
      expiry: instrument.expiry || leg.expiry || '',
      strike: instrument.strike != null ? instrument.strike : leg.strike || '',
      option_type: instrument.option_type || '',
      lot_size: instrument.lot_size || '',
      instrument_token: instrument.instrument_token || '',
    });
  };

  return (
    <div
      className={`card relative overflow-hidden transition-all duration-200 ${
        isBuy ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-300">Leg {index + 1}</span>
          {leg.symbol && (
            <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
              {leg.symbol}
            </span>
          )}
        </div>
        <button
          onClick={() => onRemove(index)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-400 hover:bg-red-600/10 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Instrument Search */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Instrument</label>
          <InstrumentSearch
            onSelect={handleInstrumentSelect}
            selected={leg.instrument}
          />
        </div>

        {/* Selected Instrument Details */}
        {leg.symbol && (
          <div className="flex flex-wrap gap-2">
            {leg.exchange && (
              <span className="text-xs bg-slate-700/80 text-slate-300 px-2 py-1 rounded">
                {leg.exchange}
              </span>
            )}
            {leg.expiry && (
              <span className="text-xs bg-slate-700/80 text-slate-300 px-2 py-1 rounded">
                Exp: {leg.expiry}
              </span>
            )}
            {leg.strike != null && leg.strike !== '' && leg.strike !== 0 && (
              <span className="text-xs bg-slate-700/80 text-indigo-300 px-2 py-1 rounded mono">
                Strike: {leg.strike}
              </span>
            )}
            {leg.option_type && (
              <span className={`text-xs px-2 py-1 rounded font-medium ${
                leg.option_type === 'CE'
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'bg-red-600/20 text-red-400'
              }`}>
                {leg.option_type}
              </span>
            )}
          </div>
        )}

        {/* Action toggle + Quantity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Action</label>
            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-all ${
                  isBuy
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
                onClick={() => handleFieldChange('action', 'BUY')}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                BUY
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-all ${
                  !isBuy
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
                onClick={() => handleFieldChange('action', 'SELL')}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                SELL
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Quantity</label>
            <input
              type="number"
              className="input-field mono"
              placeholder="0"
              min="1"
              value={leg.quantity || ''}
              onChange={(e) => handleFieldChange('quantity', parseInt(e.target.value) || '')}
            />
          </div>
        </div>

        {/* Lot size display */}
        {leg.lot_size && (
          <div className="text-xs text-slate-400">
            Lot Size: <span className="mono text-slate-300">{leg.lot_size}</span>
            {leg.quantity && (
              <span className="ml-2">
                | Total Qty: <span className="mono text-indigo-400">{leg.quantity * leg.lot_size}</span>
              </span>
            )}
          </div>
        )}

        {/* SL and Target */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Stop Loss (pts)</label>
            <input
              type="number"
              className="input-field mono"
              placeholder="0"
              min="0"
              step="0.5"
              value={leg.sl || ''}
              onChange={(e) => handleFieldChange('sl', parseFloat(e.target.value) || '')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Target (pts)</label>
            <input
              type="number"
              className="input-field mono"
              placeholder="0"
              min="0"
              step="0.5"
              value={leg.target || ''}
              onChange={(e) => handleFieldChange('target', parseFloat(e.target.value) || '')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LegCard;
