/**
 * Analytics Module Toggle Component
 * Phase 7.3: Analytics Module Toggle System
 * Real-time toggle for all 9 analytics modules
 */

'use client';

import { useAnalyticsModules } from '@/hooks/useAnalyticsModules';

export default function ModuleToggle() {
  const { modules, loading, error, toggleModule } = useAnalyticsModules();

  const handleToggle = async (moduleKey: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    await toggleModule(moduleKey, newEnabled);
    // Real-time update - UI will update immediately via hook state
  };

  if (loading) {
    return (
      <div className="glassmorphic-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-[#8BF5E6] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-secondary">लोड हो रहा है...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glassmorphic-card border border-red-500/30 p-6">
        <p className="text-red-300">{error}</p>
      </div>
    );
  }

  const enabledCount = modules.filter((m) => m.enabled).length;
  const totalCount = modules.length;

  return (
    <div className="glassmorphic-card p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">एनालिटिक्स मॉड्यूल टॉगल</h3>
        <p className="text-sm text-secondary">
          {enabledCount} / {totalCount} मॉड्यूल सक्रिय
        </p>
      </div>

      <div className="space-y-3">
        {modules.map((module) => (
          <div
            key={module.id}
            className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
              module.enabled
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-white/10 bg-white/5 opacity-60'
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h4 className="text-white font-semibold">{module.module_name_hi}</h4>
                {module.module_name_en && (
                  <span className="text-xs text-secondary">({module.module_name_en})</span>
                )}
              </div>
              <div className="text-xs text-muted font-mono mt-1">{module.module_key}</div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={module.enabled}
                onChange={() => handleToggle(module.module_key, module.enabled)}
                className="sr-only peer"
                aria-label={`Toggle ${module.module_name_hi}`}
              />
              <div className="w-11 h-6 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#8BF5E6]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8BF5E6]"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}


