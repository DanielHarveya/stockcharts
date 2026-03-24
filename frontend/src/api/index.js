import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const dbAPI = {
  connect: (config) => api.post('/database/connect', config),
  getTables: () => api.get('/database/tables'),
  getColumns: (table) => api.get(`/database/columns/${table}`),
  saveMapping: (mapping) => api.post('/database/mapping', mapping),
  getMapping: () => api.get('/database/mapping'),
  getStatus: () => api.get('/database/status'),
};

export const instrumentAPI = {
  search: (q) => api.get('/instruments/search', { params: { q } }),
  getExpiries: (symbol) => api.get('/instruments/expiries', { params: { symbol } }),
  getStrikes: (symbol, expiry) => api.get('/instruments/strikes', { params: { symbol, expiry } }),
};

export const strategyAPI = {
  create: (data) => api.post('/strategies', data),
  list: () => api.get('/strategies'),
  get: (id) => api.get(`/strategies/${id}`),
  update: (id, data) => api.put(`/strategies/${id}`, data),
  delete: (id) => api.delete(`/strategies/${id}`),
};

export const backtestAPI = {
  run: (config) => api.post('/backtest/run', config),
  status: (id) => api.get(`/backtest/${id}/status`),
  pause: (id) => api.post(`/backtest/${id}/pause`),
  resume: (id) => api.post(`/backtest/${id}/resume`),
  stop: (id) => api.post(`/backtest/${id}/stop`),
  results: (id) => api.get(`/backtest/${id}/results`),
};

export default api;
