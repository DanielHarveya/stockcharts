import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { instrumentAPI } from '../api';

function InstrumentSearch({ onSelect, selected }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [expiries, setExpiries] = useState([]);
  const [strikes, setStrikes] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [selectedStrike, setSelectedStrike] = useState('');
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchInstruments = useCallback(async (q) => {
    if (!q || q.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await instrumentAPI.search(q);
      const data = res.data.instruments || res.data || [];
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchInstruments(val), 300);
  };

  const handleSelectInstrument = async (instrument) => {
    setOpen(false);
    setQuery(instrument.symbol || instrument.tradingsymbol || '');
    setResults([]);

    // Fetch expiries for the selected symbol
    const symbol = instrument.symbol || instrument.tradingsymbol;
    try {
      const expRes = await instrumentAPI.getExpiries(symbol);
      const expData = expRes.data.expiries || expRes.data || [];
      setExpiries(expData);
    } catch {
      setExpiries([]);
    }

    onSelect(instrument);
  };

  const handleExpiryChange = async (expiry) => {
    setSelectedExpiry(expiry);
    const symbol = selected?.symbol || selected?.tradingsymbol || query;
    if (symbol && expiry) {
      try {
        const stRes = await instrumentAPI.getStrikes(symbol, expiry);
        const stData = stRes.data.strikes || stRes.data || [];
        setStrikes(stData);
      } catch {
        setStrikes([]);
      }
    } else {
      setStrikes([]);
    }
    onSelect({ ...selected, expiry });
  };

  const handleStrikeChange = (strike) => {
    setSelectedStrike(strike);
    onSelect({ ...selected, strike: parseFloat(strike) || strike });
  };

  const clearSelection = () => {
    setQuery('');
    setResults([]);
    setExpiries([]);
    setStrikes([]);
    setSelectedExpiry('');
    setSelectedStrike('');
    onSelect(null);
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          className="input-field pl-9 pr-8"
          placeholder="Search instruments..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {query && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            onClick={clearSelection}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Dropdown results */}
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-auto animate-fade-in">
            {loading ? (
              <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400">No instruments found</div>
            ) : (
              results.map((inst, idx) => (
                <button
                  key={inst.instrument_token || idx}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-b-0"
                  onClick={() => handleSelectInstrument(inst)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">
                      {inst.symbol || inst.tradingsymbol}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
                      {inst.exchange}
                    </span>
                    {inst.expiry && (
                      <span className="text-xs text-slate-400">{inst.expiry}</span>
                    )}
                    {inst.strike != null && inst.strike !== 0 && (
                      <span className="text-xs text-indigo-400 mono">{inst.strike}</span>
                    )}
                    {inst.option_type && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        inst.option_type === 'CE'
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : 'bg-red-600/20 text-red-400'
                      }`}>
                        {inst.option_type}
                      </span>
                    )}
                  </div>
                  {inst.segment && (
                    <div className="text-xs text-slate-500 mt-0.5">{inst.segment}</div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Expiry and Strike dropdowns */}
      {selected && expiries.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Expiry</label>
            <div className="relative">
              <select
                className="select-field text-sm"
                value={selectedExpiry}
                onChange={(e) => handleExpiryChange(e.target.value)}
              >
                <option value="">Select expiry</option>
                {expiries.map((exp) => (
                  <option key={exp} value={exp}>{exp}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {selectedExpiry && strikes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Strike</label>
              <div className="relative">
                <select
                  className="select-field text-sm"
                  value={selectedStrike}
                  onChange={(e) => handleStrikeChange(e.target.value)}
                >
                  <option value="">Select strike</option>
                  {strikes.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InstrumentSearch;
