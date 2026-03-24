import { useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';
import { Loader2, Play, Activity } from 'lucide-react';
import { ivAPI } from '../api';

const EXPIRY_COLORS = [
  '#818cf8', '#34d399', '#f87171', '#fbbf24', '#a78bfa',
  '#22d3ee', '#fb923c', '#e879f9', '#4ade80', '#f472b6',
];

function IVSurface() {
  const [symbol, setSymbol] = useState('');
  const [date, setDate] = useState('');
  const [underlyingPrice, setUnderlyingPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleCompute = async () => {
    if (!symbol.trim()) {
      setError('Symbol is required');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await ivAPI.surface({
        symbol: symbol.trim().toUpperCase(),
        date: date || undefined,
        underlying_price: underlyingPrice ? Number(underlyingPrice) : undefined,
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to compute IV surface');
    } finally {
      setLoading(false);
    }
  };

  const expiries = data?.expiries || [];
  const strikes = data?.strikes || [];
  const ivData = data?.iv_data || {};

  // Build chart data: one point per strike, with IV for each expiry
  const chartData = strikes.map((strike) => {
    const point = { strike };
    expiries.forEach((exp) => {
      if (ivData[exp]) {
        const entry = ivData[exp].find((e) => e.strike === strike);
        if (entry) {
          point[exp] = entry.iv != null ? Number((entry.iv * 100).toFixed(2)) : null;
        }
      }
    });
    return point;
  });

  // Flat table data
  const tableRows = [];
  expiries.forEach((exp) => {
    if (ivData[exp]) {
      ivData[exp].forEach((entry) => {
        tableRows.push({
          expiry: exp,
          strike: entry.strike,
          iv: entry.iv,
          option_type: entry.option_type || '-',
          moneyness: entry.moneyness || '-',
        });
      });
    }
  });

  const getMoneynessBg = (moneyness) => {
    if (moneyness === 'ITM') return 'bg-emerald-600/10 text-emerald-400';
    if (moneyness === 'ATM') return 'bg-indigo-600/10 text-indigo-400';
    if (moneyness === 'OTM') return 'bg-red-600/10 text-red-400';
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h3 className="text-md font-semibold text-white">IV Surface Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Symbol</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., NIFTY"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Date (optional)</label>
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Underlying Price (optional)</label>
            <input
              type="number"
              className="input-field mono"
              placeholder="Auto-detect"
              value={underlyingPrice}
              onChange={(e) => setUnderlyingPrice(e.target.value)}
            />
          </div>
        </div>

        <button
          className="btn-primary flex items-center gap-2"
          onClick={handleCompute}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? 'Computing...' : 'Compute IV Surface'}
        </button>
      </div>

      {error && (
        <div className="text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* IV Skew Chart */}
      {chartData.length > 0 && expiries.length > 0 && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">IV Skew by Expiry</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="strike"
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  label={{ value: 'Strike', position: 'insideBottom', offset: -5, style: { fill: '#64748b', fontSize: 12 } }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  label={{ value: 'IV (%)', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12 } }}
                />
                <Tooltip content={<IVTooltip underlyingPrice={data?.underlying_price} />} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} iconType="line" />

                {/* ATM reference line */}
                {data?.underlying_price && (
                  <CartesianGrid
                    horizontalPoints={[]}
                    verticalPoints={[data.underlying_price]}
                    stroke="#6366f1"
                    strokeDasharray="4 4"
                  />
                )}

                {expiries.map((exp, i) => (
                  <Line
                    key={exp}
                    type="monotone"
                    dataKey={exp}
                    name={exp}
                    stroke={EXPIRY_COLORS[i % EXPIRY_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {data?.underlying_price && (
            <div className="mt-2 text-xs text-slate-400">
              Underlying Price: <span className="mono text-indigo-400">{Number(data.underlying_price).toLocaleString()}</span>
            </div>
          )}

          {/* Color gradient legend */}
          <div className="flex items-center gap-6 mt-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-600/30" />
              <span className="text-emerald-400">ITM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-600/30" />
              <span className="text-indigo-400">ATM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-600/30" />
              <span className="text-red-400">OTM</span>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      {tableRows.length > 0 && (
        <div className="card p-6">
          <h3 className="text-md font-semibold text-white mb-4">IV Data Table</h3>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Expiry</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">Strike</th>
                  <th className="text-right py-2 px-3 text-slate-400 font-medium">IV (%)</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Type</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Moneyness</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                    <td className="py-1.5 px-3 text-slate-300 mono text-xs">{row.expiry}</td>
                    <td className="py-1.5 px-3 text-right mono text-slate-300">{row.strike}</td>
                    <td className="py-1.5 px-3 text-right mono text-indigo-400 font-medium">
                      {row.iv != null ? `${(row.iv * 100).toFixed(2)}%` : '-'}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        row.option_type === 'CE' ? 'bg-emerald-600/20 text-emerald-400' :
                        row.option_type === 'PE' ? 'bg-red-600/20 text-red-400' : 'text-slate-400'
                      }`}>
                        {row.option_type}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getMoneynessBg(row.moneyness)}`}>
                        {row.moneyness}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function IVTooltip({ active, payload, label, underlyingPrice }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">
        Strike: <span className="mono text-white">{label}</span>
        {underlyingPrice && (
          <span className="ml-2 text-slate-500">
            ({Number(label) < underlyingPrice ? 'ITM' : Number(label) === underlyingPrice ? 'ATM' : 'OTM'})
          </span>
        )}
      </p>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-slate-300">{entry.name}</span>
            </div>
            <span className="text-xs mono font-medium text-indigo-400">
              {entry.value != null ? `${entry.value}%` : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default IVSurface;
