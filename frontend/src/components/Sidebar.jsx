import { NavLink } from 'react-router-dom';
import { Database, Layers, Play, Settings } from 'lucide-react';

const navItems = [
  { to: '/settings', icon: Database, label: 'Settings' },
  { to: '/strategy', icon: Layers, label: 'Strategy' },
  { to: '/backtest', icon: Play, label: 'Backtest' },
];

function Sidebar() {
  return (
    <aside className="w-16 lg:w-56 bg-slate-900 border-r border-slate-700/50 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-slate-700/50">
        <Settings className="w-5 h-5 text-indigo-400 shrink-0" />
        <span className="ml-3 font-semibold text-sm text-white hidden lg:block truncate">
          StockCharts
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r" />
                )}
                <Icon className="w-5 h-5 shrink-0" />
                <span className="ml-3 text-sm font-medium hidden lg:block">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700/50 hidden lg:block">
        <p className="text-xs text-slate-500">v1.0.0</p>
      </div>
    </aside>
  );
}

export default Sidebar;
