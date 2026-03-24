import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from 'recharts';
import useStore from '../store/useStore';

const LEG_COLORS = [
  '#818cf8', // indigo
  '#34d399', // emerald
  '#f87171', // red
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#e879f9', // fuchsia
];

function PLChart() {
  const backtestResults = useStore((s) => s.backtestResults);

  const { chartData, legKeys } = useMemo(() => {
    if (!backtestResults || backtestResults.length === 0) {
      return { chartData: [], legKeys: [] };
    }

    const keys = new Set();
    const data = backtestResults.map((r) => {
      const point = {
        time: r.timestamp || r.time || '',
        displayTime: formatTime(r.timestamp || r.time || ''),
        total_pnl: r.total_pnl ?? r.total ?? 0,
      };

      // leg_results is an ARRAY from backend
      if (r.leg_results && Array.isArray(r.leg_results)) {
        r.leg_results.forEach((lr) => {
          const key = `leg_${lr.symbol || lr.leg_id}`;
          keys.add(key);
          point[key] = lr.pnl ?? 0;
        });
      } else if (r.legs) {
        Object.entries(r.legs).forEach(([legName, legData]) => {
          const key = `leg_${legName}`;
          keys.add(key);
          point[key] = legData.pnl ?? legData ?? 0;
        });
      } else if (r.leg_pnls) {
        Object.entries(r.leg_pnls).forEach(([legName, pnl]) => {
          const key = `leg_${legName}`;
          keys.add(key);
          point[key] = pnl;
        });
      }

      return point;
    });

    return { chartData: data, legKeys: Array.from(keys) };
  }, [backtestResults]);

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-2 opacity-30">&#x2195;</div>
          <p className="text-sm">P&L chart will appear when backtest runs</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="displayTime"
          stroke="#64748b"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={{ stroke: '#475569' }}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="#64748b"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={{ stroke: '#475569' }}
          tickFormatter={(v) => v.toLocaleString()}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
          iconType="line"
        />
        <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />

        {/* Leg lines */}
        {legKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={key.replace('leg_', 'Leg ')}
            stroke={LEG_COLORS[i % LEG_COLORS.length]}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}

        {/* Total P&L line */}
        <Line
          type="monotone"
          dataKey="total_pnl"
          name="Total P&L"
          stroke="#ffffff"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-2 mono">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-slate-300">{entry.name}</span>
            </div>
            <span className={`text-xs mono font-medium ${
              entry.value >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {entry.value >= 0 ? '+' : ''}{Number(entry.value).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return String(timestamp).slice(-8);
  }
}

export default PLChart;
