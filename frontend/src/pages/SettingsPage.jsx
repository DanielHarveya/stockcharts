import DatabaseConfig from '../components/DatabaseConfig';

function SettingsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure database connection and column mappings</p>
      </div>
      <DatabaseConfig />
    </div>
  );
}

export default SettingsPage;
