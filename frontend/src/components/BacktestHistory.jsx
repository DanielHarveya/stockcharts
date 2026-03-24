import { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2, CheckSquare, Square, BarChart3, Eye, RefreshCw } from 'lucide-react';
import { historyAPI } from '../api';

function BacktestHistory({ onCompare, onViewResult }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await historyAPI.list();
      setItems(res.data.history || res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await historyAPI.delete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const handleCompare = () => {
    if (selected.size < 2) return;
    if (onCompare) {
      onCompare(Array.from(selected));
    }
  };

  const handleView = async (item) => {
    if (onViewResult) {
      try {
        const res = await historyAPI.get(item.id);
        onViewResult(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Failed to load result');
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatPnl = (value) => {
    if (value == null || isNaN(value)) return '-';
    const num = Number(value);
    const formatted = Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-emerald-600/20 text-emerald-400',
      running: 'bg-blue-600/20 text-blue-400',
      failed: 'bg-red-600/20 text-red-400',
      stopped: 'bg-amber-600/20 text-amber-400',
    };
    return styles[status] || 'bg-slate-600/20 text-slate-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        <span className="ml-3 text-slate-400">Loading history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-40"
            disabled={selected.size < 2}
            onClick={handleCompare}
          >
            <BarChart3 className="w-4 h-4" />
            Compare Selected ({selected.size})
          </button>
          <button className="btn-secondary text-sm flex items-center gap-2" onClick={fetchHistory}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        <span className="text-xs text-slate-500">{items.length} backtest{items.length !== 1 ? 's' : ''}</span>
      </div>

      {error && (
        <div className="text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No backtest history yet. Run a backtest to see it here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isSelected = selected.has(item.id);
            const pnlValue = item.net_pnl ?? item.total_pnl ?? null;
            const pnlPositive = pnlValue != null && pnlValue >= 0;

            return (
              <div
                key={item.id}
                className={`card px-5 py-4 flex items-center gap-4 transition-all cursor-pointer ${
                  isSelected ? 'border-indigo-500/50 bg-indigo-600/5' : ''
                }`}
                onClick={() => toggleSelect(item.id)}
              >
                {/* Checkbox */}
                <div className="shrink-0">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-500" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white truncate">
                      {item.name || item.strategy_name || 'Unnamed'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getStatusBadge(item.status)}`}>
                      {item.status || 'completed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-slate-400">
                      {item.strategy || item.strategy_type || ''}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDate(item.created_at || item.date)}
                    </span>
                    {item.start_date && item.end_date && (
                      <span className="text-xs text-slate-500 mono">
                        {item.start_date} to {item.end_date}
                      </span>
                    )}
                  </div>
                </div>

                {/* P&L */}
                <div className="shrink-0 text-right">
                  <span className={`text-sm mono font-semibold ${
                    pnlPositive ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {formatPnl(pnlValue)}
                  </span>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-400 hover:bg-indigo-600/10 transition-all"
                    onClick={() => handleView(item)}
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-400 hover:bg-red-600/10 transition-all"
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    title="Delete"
                  >
                    {deleting === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BacktestHistory;
