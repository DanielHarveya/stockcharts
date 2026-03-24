import { useState, useEffect } from 'react';
import { Plus, Save, Layers, Edit3, Trash2, Loader2 } from 'lucide-react';
import useStore from '../store/useStore';
import LegCard from './LegCard';

const emptyLeg = {
  instrument: null,
  symbol: '',
  exchange: '',
  expiry: '',
  strike: '',
  option_type: '',
  lot_size: '',
  instrument_token: '',
  action: 'BUY',
  quantity: 1,
  sl: '',
  target: '',
};

function StrategyBuilder() {
  const {
    strategies, currentStrategy, loadStrategies, createStrategy,
    updateStrategy, deleteStrategy, setCurrentStrategy, strategiesLoading,
  } = useStore();

  const [name, setName] = useState('');
  const [legs, setLegs] = useState([{ ...emptyLeg }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  useEffect(() => {
    if (currentStrategy && editingId === currentStrategy.id) {
      setName(currentStrategy.name || '');
      setLegs(currentStrategy.legs && currentStrategy.legs.length > 0
        ? currentStrategy.legs
        : [{ ...emptyLeg }]);
    }
  }, [currentStrategy, editingId]);

  const handleAddLeg = () => {
    setLegs([...legs, { ...emptyLeg }]);
  };

  const handleLegChange = (index, updatedLeg) => {
    const newLegs = [...legs];
    newLegs[index] = updatedLeg;
    setLegs(newLegs);
  };

  const handleRemoveLeg = (index) => {
    if (legs.length <= 1) return;
    setLegs(legs.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Strategy name is required');
      return;
    }
    setError(null);
    setSuccess(null);
    setSaving(true);

    const data = { name: name.trim(), legs };

    try {
      if (editingId) {
        await updateStrategy(editingId, data);
        setSuccess('Strategy updated successfully!');
      } else {
        await createStrategy(data);
        setSuccess('Strategy created successfully!');
      }
      setTimeout(() => setSuccess(null), 3000);
      handleReset();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save strategy');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (strategy) => {
    setEditingId(strategy.id);
    setCurrentStrategy(strategy);
    setName(strategy.name || '');
    setLegs(strategy.legs && strategy.legs.length > 0
      ? strategy.legs.map((l) => ({ ...emptyLeg, ...l }))
      : [{ ...emptyLeg }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    try {
      await deleteStrategy(id);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete');
    }
  };

  const handleReset = () => {
    setEditingId(null);
    setName('');
    setLegs([{ ...emptyLeg }]);
    setCurrentStrategy(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Strategy Name */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {editingId ? 'Edit Strategy' : 'New Strategy'}
            </h2>
            <p className="text-sm text-slate-400">Define your options strategy with multiple legs</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Strategy Name</label>
          <input
            type="text"
            className="input-field max-w-md"
            placeholder="e.g., Iron Condor NIFTY"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      {/* Legs */}
      <div className="space-y-4">
        {legs.map((leg, i) => (
          <LegCard
            key={i}
            leg={leg}
            index={i}
            onChange={handleLegChange}
            onRemove={handleRemoveLeg}
          />
        ))}
      </div>

      {/* Add Leg + Save */}
      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn-secondary flex items-center gap-2" onClick={handleAddLeg}>
          <Plus className="w-4 h-4" />
          Add Leg
        </button>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : editingId ? 'Update Strategy' : 'Save Strategy'}
        </button>
        {editingId && (
          <button className="btn-secondary text-sm" onClick={handleReset}>
            Cancel Edit
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-600/10 border border-emerald-600/20 rounded-lg px-4 py-3 text-sm">
          {success}
        </div>
      )}

      {/* Saved Strategies List */}
      <div className="card p-6">
        <h3 className="text-md font-semibold text-white mb-4">Saved Strategies</h3>
        {strategiesLoading ? (
          <div className="flex items-center gap-2 text-slate-400 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading strategies...
          </div>
        ) : strategies.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No strategies saved yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="px-4 py-3 bg-slate-800/60 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <div>
                      <span className="text-sm font-medium text-white">{strategy.name}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        {strategy.legs?.length || 0} leg{(strategy.legs?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-400 hover:bg-indigo-600/10 transition-all"
                      onClick={() => handleEdit(strategy)}
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-400 hover:bg-red-600/10 transition-all"
                      onClick={() => handleDelete(strategy.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Leg Summary */}
                {strategy.legs && strategy.legs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {strategy.legs.map((leg, li) => (
                      <span
                        key={li}
                        className={`text-xs px-2 py-1 rounded-md border ${
                          leg.action === 'BUY'
                            ? 'bg-emerald-600/10 border-emerald-600/30 text-emerald-400'
                            : 'bg-red-600/10 border-red-600/30 text-red-400'
                        }`}
                      >
                        {leg.action} {leg.quantity || 1}x {leg.symbol || 'N/A'}
                        {leg.strike ? ` ${leg.strike}` : ''}
                        {leg.option_type ? ` ${leg.option_type}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StrategyBuilder;
