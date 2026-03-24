import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, YAxis, Tooltip,
} from 'recharts';
import useStore from '../store/useStore';

const GREEK_KEYS = ['delta', 'gamma', 'theta', 'vega', 'iv'];

const GREEK_COLORS = {
  delta: '#818cf8',
  gamma: '#34d399',
  theta: '#f87171',
  vega: '#fbbf24',
  iv: '#a78bfa',
};

function GreeksPanel() {
  const backtestResults = useStore((s) => s.backtestResults);

  const { latestGreeks, legNames, greeksHistory } = useMemo(() => {
    if (!backtestResults || backtestResults.length === 0) {
      return { latestGreeks: {}, legNames: [], greeksHistory: {} };
    }

    const names = new Set();
    const history = {};
    let latest = {};

    backtestResults.forEach((r) => {
      // leg_results is an ARRAY from backend
      if (r.leg_results && Array.isArray(r.leg_results)) {
        r.leg_results.forEach((lr) => {
          const name = lr.symbol || lr.leg_id;
          names.add(name);
          if (!history[name]) history[name] = [];
          const greekPoint = { time: r.timestamp || '' };
          GREEK_KEYS.forEach((g) => {
            greekPoint[g] = lr[g] ?? 0;
          });
          history[name].push(greekPoint);
        });
      } else {
        const legsData = r.legs || r.greeks || {};
        Object.entries(legsData).forEach(([name, data]) => {
          if (typeof data !== 'object') return;
          names.add(name);
          if (!history[name]) history[name] = [];
          const greekPoint = { time: r.timestamp || r.time || '' };
          GREEK_KEYS.forEach((g) => {
            greekPoint[g] = data[g] ?? data.greeks?.[g] ?? 0;
          });
          history[name].push(greekPoint);
        });
      }
    });

    // Get latest values
    const lastResult = backtestResults[backtestResults.length - 1];
    if (lastResult?.leg_results && Array.isArray(lastResult.leg_results)) {
      lastResult.leg_results.forEach((lr) => {
        const name = lr.symbol || lr.leg_id;
        latest[name] = {};
        GREEK_KEYS.forEach((g) => {
          latest[name][g] = lr[g] ?? 0;
        });
      });
    } else {
      const lastLegs = lastResult?.legs || lastResult?.greeks || {};
      Object.entries(lastLegs).forEach(([name, data]) => {
        if (typeof data !== 'object') return;
        latest[name] = {};
        GREEK_KEYS.forEach((g) => {
          latest[name][g] = data[g] ?? data.greeks?.[g] ?? 0;
        });
      });
    }

    return { latestGreeks: latest, legNames: Array.from(names), greeksHistory: history };
  }, [backtestResults]);

  // Calculate totals
  const totals = useMemo(() => {
    const t = {};
    GREEK_KEYS.forEach((g) => {
      t[g] = Object.values(latestGreeks).reduce((sum, leg) => sum + (leg[g] || 0), 0);
    });
    return t;
  }, [latestGreeks]);

  if (legNames.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <p className="text-sm">Greeks data will appear when backtest runs</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-6">
      {/* Greeks Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Leg
              </th>
              {GREEK_KEYS.map((g) => (
                <th
                  key={g}
                  className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: GREEK_COLORS[g] }}
                >
                  {g === 'iv' ? 'IV' : g.charAt(0).toUpperCase() + g.slice(1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {legNames.map((name) => (
              <tr
                key={name}
                className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-white font-medium">{name}</td>
                {GREEK_KEYS.map((g) => (
                  <td key={g} className="px-4 py-3 text-right mono text-sm text-slate-300">
                    {formatGreek(latestGreeks[name]?.[g], g)}
                  </td>
                ))}
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="bg-slate-800/60 border-t-2 border-slate-600">
              <td className="px-4 py-3 text-sm font-bold text-white">Total</td>
              {GREEK_KEYS.map((g) => (
                <td
                  key={g}
                  className="px-4 py-3 text-right mono text-sm font-bold"
                  style={{ color: GREEK_COLORS[g] }}
                >
                  {formatGreek(totals[g], g)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sparkline Charts */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Greeks Over Time</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {legNames.map((name) => {
            const data = greeksHistory[name] || [];
            if (data.length < 2) return null;
            return (
              <div key={name} className="card p-4">
                <p className="text-xs font-medium text-slate-400 mb-3">{name}</p>
                <div className="space-y-3">
                  {GREEK_KEYS.map((g) => (
                    <div key={g} className="flex items-center gap-3">
                      <span
                        className="text-[10px] font-medium uppercase w-12 shrink-0"
                        style={{ color: GREEK_COLORS[g] }}
                      >
                        {g === 'iv' ? 'IV' : g}
                      </span>
                      <div className="flex-1 h-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data}>
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.[0]) return null;
                                return (
                                  <div className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-[10px] mono" style={{ color: GREEK_COLORS[g] }}>
                                    {formatGreek(payload[0].value, g)}
                                  </div>
                                );
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey={g}
                              stroke={GREEK_COLORS[g]}
                              strokeWidth={1.5}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <span className="text-[10px] mono text-slate-400 w-14 text-right shrink-0">
                        {formatGreek(latestGreeks[name]?.[g], g)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatGreek(value, key) {
  if (value == null || isNaN(value)) return '-';
  if (key === 'iv') return (value * 100).toFixed(2) + '%';
  if (key === 'gamma') return value.toFixed(6);
  return value.toFixed(4);
}

export default GreeksPanel;
