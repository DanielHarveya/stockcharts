import { useState } from 'react';
import { Database, CheckCircle, XCircle, Loader2, Layers } from 'lucide-react';
import useStore from '../store/useStore';
import { dbAPI } from '../api';

function DatabaseConfig() {
  const {
    dbConfig, setDbConfig, dbConnected, dbConnecting, dbError, connectDb,
    tables, ohlcMapping, instrumentMapping, setOhlcMapping, setInstrumentMapping,
    saveMapping, mappingConfigured, mappingSaving,
  } = useStore();

  const [ohlcColumns, setOhlcColumns] = useState([]);
  const [instrColumns, setInstrColumns] = useState([]);
  const [mappingError, setMappingError] = useState(null);
  const [mappingSuccess, setMappingSuccess] = useState(false);

  const handleConnect = async () => {
    await connectDb();
  };

  const handleOhlcTableChange = async (tableName) => {
    setOhlcMapping({ table_name: tableName });
    if (tableName) {
      try {
        const res = await dbAPI.getColumns(tableName);
        setOhlcColumns(res.data.columns || res.data || []);
      } catch {
        setOhlcColumns([]);
      }
    } else {
      setOhlcColumns([]);
    }
  };

  const handleInstrTableChange = async (tableName) => {
    setInstrumentMapping({ table_name: tableName });
    if (tableName) {
      try {
        const res = await dbAPI.getColumns(tableName);
        setInstrColumns(res.data.columns || res.data || []);
      } catch {
        setInstrColumns([]);
      }
    } else {
      setInstrColumns([]);
    }
  };

  const handleSaveMapping = async () => {
    setMappingError(null);
    setMappingSuccess(false);
    try {
      await saveMapping();
      setMappingSuccess(true);
      setTimeout(() => setMappingSuccess(false), 3000);
    } catch (err) {
      setMappingError(err.response?.data?.detail || err.message || 'Failed to save mapping');
    }
  };

  const ohlcFields = [
    { key: 'instrument_token_col', label: 'Instrument Token' },
    { key: 'datetime_col', label: 'DateTime' },
    { key: 'open_col', label: 'Open' },
    { key: 'high_col', label: 'High' },
    { key: 'low_col', label: 'Low' },
    { key: 'close_col', label: 'Close' },
    { key: 'volume_col', label: 'Volume' },
  ];

  const instrFields = [
    { key: 'instrument_token_col', label: 'Instrument Token' },
    { key: 'exchange_col', label: 'Exchange' },
    { key: 'segment_col', label: 'Segment' },
    { key: 'symbol_col', label: 'Symbol' },
    { key: 'expiry_col', label: 'Expiry' },
    { key: 'strike_col', label: 'Strike' },
    { key: 'option_type_col', label: 'Option Type' },
    { key: 'lot_size_col', label: 'Lot Size' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Database Connection */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Database Connection</h2>
              <p className="text-sm text-slate-400">Configure your PostgreSQL database connection</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dbConnected ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                <span className="text-sm text-emerald-400 font-medium">Connected</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="text-sm text-red-400 font-medium">Disconnected</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Host</label>
            <input
              type="text"
              className="input-field"
              placeholder="localhost"
              value={dbConfig.host}
              onChange={(e) => setDbConfig({ host: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Port</label>
            <input
              type="text"
              className="input-field"
              placeholder="5432"
              value={dbConfig.port}
              onChange={(e) => setDbConfig({ port: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
            <input
              type="text"
              className="input-field"
              placeholder="postgres"
              value={dbConfig.user}
              onChange={(e) => setDbConfig({ user: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Enter password"
              value={dbConfig.password}
              onChange={(e) => setDbConfig({ password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Database Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="stockdata"
              value={dbConfig.dbname}
              onChange={(e) => setDbConfig({ dbname: e.target.value })}
            />
          </div>
        </div>

        {dbError && (
          <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3">
            <XCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{dbError}</span>
          </div>
        )}

        <div className="mt-6">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleConnect}
            disabled={dbConnecting}
          >
            {dbConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            {dbConnecting ? 'Connecting...' : 'Test & Connect'}
          </button>
        </div>
      </div>

      {/* Column Mapping */}
      {dbConnected && (
        <div className="card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Column Mapping</h2>
              <p className="text-sm text-slate-400">Map your database columns to the required fields</p>
            </div>
            {mappingConfigured && (
              <div className="ml-auto flex items-center gap-1.5 text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Configured</span>
              </div>
            )}
          </div>

          {/* OHLC Mapping */}
          <div className="mb-8">
            <h3 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              OHLC Table Mapping
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Select Table</label>
              <select
                className="select-field"
                value={ohlcMapping.table_name}
                onChange={(e) => handleOhlcTableChange(e.target.value)}
              >
                <option value="">-- Select a table --</option>
                {tables.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {ohlcMapping.table_name && ohlcColumns.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {ohlcFields.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
                    <select
                      className="select-field"
                      value={ohlcMapping[key]}
                      onChange={(e) => setOhlcMapping({ [key]: e.target.value })}
                    >
                      <option value="">-- Select column --</option>
                      {ohlcColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instrument Master Mapping */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Instrument Master Mapping
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Select Table</label>
              <select
                className="select-field"
                value={instrumentMapping.table_name}
                onChange={(e) => handleInstrTableChange(e.target.value)}
              >
                <option value="">-- Select a table --</option>
                {tables.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {instrumentMapping.table_name && instrColumns.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {instrFields.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
                    <select
                      className="select-field"
                      value={instrumentMapping[key]}
                      onChange={(e) => setInstrumentMapping({ [key]: e.target.value })}
                    >
                      <option value="">-- Select column --</option>
                      {instrColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {mappingError && (
            <div className="mb-4 flex items-center gap-2 text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3">
              <XCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{mappingError}</span>
            </div>
          )}

          {mappingSuccess && (
            <div className="mb-4 flex items-center gap-2 text-emerald-400 bg-emerald-600/10 border border-emerald-600/20 rounded-lg px-4 py-3">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">Mapping saved successfully!</span>
            </div>
          )}

          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleSaveMapping}
            disabled={mappingSaving}
          >
            {mappingSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {mappingSaving ? 'Saving...' : 'Save Mapping'}
          </button>
        </div>
      )}
    </div>
  );
}

export default DatabaseConfig;
