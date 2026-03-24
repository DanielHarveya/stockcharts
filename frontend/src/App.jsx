import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import SettingsPage from './pages/SettingsPage';
import StrategyPage from './pages/StrategyPage';
import BacktestPage from './pages/BacktestPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/settings" replace />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="strategy" element={<StrategyPage />} />
        <Route path="backtest" element={<BacktestPage />} />
        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
