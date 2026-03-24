import { create } from 'zustand';
import { dbAPI, strategyAPI, backtestAPI } from '../api';

const useStore = create((set, get) => ({
  // Database
  dbConfig: {
    host: 'localhost',
    port: '5432',
    user: '',
    password: '',
    dbname: '',
  },
  dbConnected: false,
  dbConnecting: false,
  dbError: null,
  tables: [],

  // Column Mapping
  ohlcMapping: {
    table_name: '',
    instrument_token_col: '',
    datetime_col: '',
    open_col: '',
    high_col: '',
    low_col: '',
    close_col: '',
    volume_col: '',
  },
  instrumentMapping: {
    table_name: '',
    instrument_token_col: '',
    exchange_col: '',
    segment_col: '',
    symbol_col: '',
    expiry_col: '',
    strike_col: '',
    option_type_col: '',
    lot_size_col: '',
  },
  mappingConfigured: false,
  mappingSaving: false,

  // Strategy
  strategies: [],
  currentStrategy: null,
  strategiesLoading: false,

  // Backtest
  backtestId: null,
  backtestStatus: 'idle',
  backtestResults: [],
  backtestConfig: {
    start_date: '',
    end_date: '',
    interval_minutes: 1,
    entry_time: '09:20',
  },
  backtestElapsed: 0,
  backtestCurrentTimestamp: null,

  // Database Actions
  setDbConfig: (config) =>
    set((state) => ({ dbConfig: { ...state.dbConfig, ...config } })),

  connectDb: async () => {
    const { dbConfig } = get();
    set({ dbConnecting: true, dbError: null });
    try {
      await dbAPI.connect(dbConfig);
      set({ dbConnected: true, dbConnecting: false });
      await get().fetchTables();
      // Try to load existing mapping
      try {
        const res = await dbAPI.getMapping();
        if (res.data && res.data.ohlc_mapping) {
          set({
            ohlcMapping: res.data.ohlc_mapping,
            instrumentMapping: res.data.instrument_mapping,
            mappingConfigured: true,
          });
        }
      } catch {
        // No existing mapping, that's fine
      }
    } catch (err) {
      set({
        dbConnected: false,
        dbConnecting: false,
        dbError: err.response?.data?.detail || err.message || 'Connection failed',
      });
    }
  },

  fetchTables: async () => {
    try {
      const res = await dbAPI.getTables();
      set({ tables: res.data.tables || res.data || [] });
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  },

  saveMapping: async () => {
    const { ohlcMapping, instrumentMapping } = get();
    set({ mappingSaving: true });
    try {
      await dbAPI.saveMapping({
        ohlc_mapping: ohlcMapping,
        instrument_mapping: instrumentMapping,
      });
      set({ mappingConfigured: true, mappingSaving: false });
    } catch (err) {
      set({ mappingSaving: false });
      throw err;
    }
  },

  setOhlcMapping: (mapping) =>
    set((state) => ({ ohlcMapping: { ...state.ohlcMapping, ...mapping } })),

  setInstrumentMapping: (mapping) =>
    set((state) => ({ instrumentMapping: { ...state.instrumentMapping, ...mapping } })),

  // Strategy Actions
  createStrategy: async (data) => {
    try {
      const res = await strategyAPI.create(data);
      const strategy = res.data;
      set((state) => ({
        strategies: [...state.strategies, strategy],
        currentStrategy: strategy,
      }));
      return strategy;
    } catch (err) {
      console.error('Failed to create strategy:', err);
      throw err;
    }
  },

  loadStrategies: async () => {
    set({ strategiesLoading: true });
    try {
      const res = await strategyAPI.list();
      set({ strategies: res.data.strategies || res.data || [], strategiesLoading: false });
    } catch (err) {
      set({ strategiesLoading: false });
      console.error('Failed to load strategies:', err);
    }
  },

  updateStrategy: async (id, data) => {
    try {
      const res = await strategyAPI.update(id, data);
      const updated = res.data;
      set((state) => ({
        strategies: state.strategies.map((s) => (s.id === id ? updated : s)),
        currentStrategy: state.currentStrategy?.id === id ? updated : state.currentStrategy,
      }));
      return updated;
    } catch (err) {
      console.error('Failed to update strategy:', err);
      throw err;
    }
  },

  deleteStrategy: async (id) => {
    try {
      await strategyAPI.delete(id);
      set((state) => ({
        strategies: state.strategies.filter((s) => s.id !== id),
        currentStrategy: state.currentStrategy?.id === id ? null : state.currentStrategy,
      }));
    } catch (err) {
      console.error('Failed to delete strategy:', err);
      throw err;
    }
  },

  setCurrentStrategy: (strategy) => set({ currentStrategy: strategy }),

  // Backtest Actions
  setBacktestConfig: (config) =>
    set((state) => ({ backtestConfig: { ...state.backtestConfig, ...config } })),

  startBacktest: async () => {
    const { currentStrategy, backtestConfig } = get();
    if (!currentStrategy) return;
    set({ backtestStatus: 'running', backtestResults: [], backtestElapsed: 0, backtestCurrentTimestamp: null });
    try {
      const res = await backtestAPI.run({
        strategy_id: currentStrategy.id,
        ...backtestConfig,
      });
      set({ backtestId: res.data.backtest_id || res.data.id });
    } catch (err) {
      set({ backtestStatus: 'idle' });
      console.error('Failed to start backtest:', err);
    }
  },

  pauseBacktest: async () => {
    const { backtestId } = get();
    if (!backtestId) return;
    try {
      await backtestAPI.pause(backtestId);
      set({ backtestStatus: 'paused' });
    } catch (err) {
      console.error('Failed to pause backtest:', err);
    }
  },

  resumeBacktest: async () => {
    const { backtestId } = get();
    if (!backtestId) return;
    try {
      await backtestAPI.resume(backtestId);
      set({ backtestStatus: 'running' });
    } catch (err) {
      console.error('Failed to resume backtest:', err);
    }
  },

  stopBacktest: async () => {
    const { backtestId } = get();
    if (!backtestId) return;
    try {
      await backtestAPI.stop(backtestId);
      set({ backtestStatus: 'stopped' });
    } catch (err) {
      console.error('Failed to stop backtest:', err);
    }
  },

  addResult: (result) =>
    set((state) => ({
      backtestResults: [...state.backtestResults, result],
      backtestCurrentTimestamp: result.timestamp || result.time,
    })),

  clearResults: () =>
    set({ backtestResults: [], backtestId: null, backtestStatus: 'idle', backtestElapsed: 0, backtestCurrentTimestamp: null }),

  setBacktestStatus: (status) => set({ backtestStatus: status }),
  setBacktestElapsed: (elapsed) => set({ backtestElapsed: elapsed }),
}));

export default useStore;
