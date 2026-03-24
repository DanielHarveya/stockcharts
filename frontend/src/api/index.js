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
  analytics: (id) => api.get(`/backtest/${id}/analytics`),
  events: (id) => api.get(`/backtest/${id}/events`),
  validation: (id) => api.get(`/backtest/${id}/validation`),
  exportCsv: (id) => window.open(`/api/backtest/${id}/export/csv`, '_blank'),
};

export const historyAPI = {
  list: () => api.get('/history'),
  get: (id) => api.get(`/history/${id}`),
  delete: (id) => api.delete(`/history/${id}`),
  compare: (ids) => api.get('/history/compare', { params: { ids: ids.join(',') } }),
};

export const templateAPI = {
  list: () => api.get('/templates'),
  get: (name) => api.get(`/templates/${name}`),
};

export const scenarioAPI = {
  analyze: (data) => api.post('/scenario/analyze', data),
  matrix: (data) => api.post('/scenario/matrix', data),
};

export const portfolioAPI = {
  run: (data) => api.post('/portfolio/run', data),
  status: (id) => api.get(`/portfolio/${id}/status`),
  results: (id) => api.get(`/portfolio/${id}/results`),
  analytics: (id) => api.get(`/portfolio/${id}/analytics`),
};

export const ivAPI = {
  surface: (data) => api.post('/iv/surface', data),
};

export const walkforwardAPI = {
  run: (data) => api.post('/walkforward/run', data),
};

export const optimizerAPI = {
  run: (data) => api.post('/optimizer/run', data),
};

export default api;
