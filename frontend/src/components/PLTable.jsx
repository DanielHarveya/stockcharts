import { useMemo, useRef, useEffect } from 'react';
import useStore from '../store/useStore';

function PLTable() {
  const backtestResults = useStore((s) => s.backtestResults);
  const backtestStatus = useStore((s) => s.backtestStatus);
  const tableEndRef = useRef(null);

  // Auto-scroll when running
  useEffect(() => {
    if (backtestStatus === 'running' && tableEndRef.current) {
      tableEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [backtestResults.length, backtestStatus]);

  const { rows, legNames } = useMemo(() => {
    if (!backtestResults || backtestResults.length === 0) {
      return { rows: [], legNames: [] };
    }

    const names = new Set();
    const processedRows = backtestResults.map((r) => {
      const row = {
        time: formatTimestamp(r.timestamp || r.time || ''),
        total_pnl: r.total_pnl ?? r.total ?? 0,
        legs: {},
      };

      // leg_results is an ARRAY from backend
      if (r.leg_results && Array.isArray(r.leg_results)) {
        r.leg_results.forEach((lr) => {
          const name = lr.symbol || lr.leg_id;
          names.add(name);
          row.legs[name] = {
            symbol: lr.symbol || name,
            price: lr.current_price ?? '-',
            pnl: lr.pnl ?? 0,
            sl_hit: lr.exit_reason === 'stop_loss',
            target_hit: lr.exit_reason === 'target',
            state: lr.state || 'ENTERED',
            exit_reason: lr.exit_reason || 'active',
            is_active: lr.is_active !== false,
          };
        });
      } else {
        const legsData = r.legs || r.leg_pnls || {};
        Object.entries(legsData).forEach(([name, data]) => {
          names.add(name);
          if (typeof data === 'object') {
            row.legs[name] = {
              symbol: data.symbol || name,
              price: data.price ?? data.ltp ?? '-',
              pnl: data.pnl ?? 0,
              sl_hit: data.sl_hit || false,
              target_hit: data.target_hit || false,
              state: data.state || 'ENTERED',
              exit_reason: data.exit_reason || 'active',
              is_active: data.is_active !== false,
            };
          } else {
            row.legs[name] = {
              symbol: name,
              price: '-',
              pnl: data,
              sl_hit: false,
              target_hit: false,
              state: 'ENTERED',
              exit_reason: 'active',
              is_active: true,
            };
          }
        });
      }

      return row;
    });

    return { rows: processedRows, legNames: Array.from(names) };
  }, [backtestResults]);

  if (rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <p className="text-sm">P&L table will populate when backtest runs</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-800 border-b border-slate-700">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Time
            </th>
            {legNames.map((name) => (
              <th
                key={`${name}-header`}
                colSpan={3}
                className="text-center px-2 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-l border-slate-700"
              >
                {name}
              </th>
            ))}
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-l border-slate-700">
              Total P&L
            </th>
          </tr>
          <tr className="bg-slate-800/80 border-b border-slate-700">
            <th className="px-4 py-1.5" />
            {legNames.map((name) => (
              <th key={`${name}-sub`} colSpan={3} className="border-l border-slate-700">
                <div className="flex text-xs text-slate-500">
                  <span className="flex-1 text-center px-1">Symbol</span>
                  <span className="flex-1 text-center px-1">Price</span>
                  <span className="flex-1 text-center px-1">P&L</span>
                </div>
              </th>
            ))}
            <th className="border-l border-slate-700" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-slate-700/30 transition-colors hover:bg-slate-700/20 ${
                i % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'
              }`}
            >
              <td className="px-4 py-2.5 text-xs mono text-slate-300 whitespace-nowrap">
                {row.time}
              </td>
              {legNames.map((name) => {
                const leg = row.legs[name] || {};
                return (
                  <td key={`${name}-${i}`} colSpan={3} className="border-l border-slate-700/30">
                    <div className="flex items-center text-xs">
                      <span className="flex-1 text-center px-1 text-slate-400 truncate">
                        {leg.symbol || '-'}
                      </span>
                      <span className="flex-1 text-center px-1 mono text-slate-300">
                        {leg.price !== '-' ? Number(leg.price).toFixed(2) : '-'}
                      </span>
                      <span className={`flex-1 text-center px-1 mono font-medium ${
                        (leg.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {(leg.pnl ?? 0) >= 0 ? '+' : ''}{Number(leg.pnl ?? 0).toFixed(2)}
                        {!leg.is_active && leg.exit_reason !== 'active' && (
                          <span className={`ml-1 text-[10px] px-1 rounded ${
                            leg.exit_reason === 'stop_loss' ? 'bg-red-600/20 text-red-400' :
                            leg.exit_reason === 'target' ? 'bg-emerald-600/20 text-emerald-400' :
                            leg.exit_reason === 'time_exit' ? 'bg-amber-600/20 text-amber-400' :
                            leg.exit_reason === 'risk_limit' ? 'bg-red-600/30 text-red-300' :
                            'bg-slate-600/20 text-slate-400'
                          }`}>
                            {leg.exit_reason === 'stop_loss' ? 'SL' :
                             leg.exit_reason === 'target' ? 'TGT' :
                             leg.exit_reason === 'time_exit' ? 'TIME' :
                             leg.exit_reason === 'risk_limit' ? 'RISK' : leg.exit_reason}
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                );
              })}
              <td className={`px-4 py-2.5 text-right mono text-sm font-semibold border-l border-slate-700/30 ${
                row.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {row.total_pnl >= 0 ? '+' : ''}{Number(row.total_pnl).toFixed(2)}
              </td>
            </tr>
          ))}
          <tr ref={tableEndRef} />
        </tbody>
      </table>
    </div>
  );
}

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return String(ts);
  }
}

export default PLTable;
