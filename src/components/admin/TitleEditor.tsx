/**
 * Title Editor Component
 * Phase 7.2: Dynamic Title & Header Editor
 * Allows inline editing of titles with Hindi + English support
 */

'use client';

import { useState, useEffect } from 'react';
import { useEditableTitles } from '@/hooks/useEditableTitles';
import { CMSTitle } from '@/types/cms';

export default function TitleEditor() {
  const { titles, loading, error, updateTitle, refreshTitles } = useEditableTitles();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ hi: string; en: string }>({ hi: '', en: '' });
  const [saving, setSaving] = useState(false);

  const handleEdit = (title: CMSTitle) => {
    setEditingKey(title.key);
    setEditValues({
      hi: title.value_hi,
      en: title.value_en || '',
    });
  };

  const handleSave = async (key: string, section: string) => {
    if (!editValues.hi.trim()) {
      alert('Hindi value is required');
      return;
    }

    setSaving(true);
    try {
      const success = await updateTitle(key, editValues.hi.trim(), editValues.en.trim() || undefined, section);
      if (success) {
        setEditingKey(null);
        await refreshTitles();
      }
    } catch (err) {
      console.error('Failed to save title:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValues({ hi: '', en: '' });
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

  const groupedTitles = titles.reduce((acc, title) => {
    if (!acc[title.section]) {
      acc[title.section] = [];
    }
    acc[title.section].push(title);
    return acc;
  }, {} as Record<string, CMSTitle[]>);

  return (
    <div className="glassmorphic-card p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">शीर्षक संपादक</h3>
        <p className="text-sm text-secondary">किसी भी शीर्षक पर क्लिक करके संपादित करें</p>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedTitles).map(([section, sectionTitles]) => (
          <div key={section} className="border-b border-white/10 pb-4 last:border-0">
            <h4 className="text-lg font-semibold text-white mb-3 capitalize">{section}</h4>
            <div className="space-y-3">
              {sectionTitles.map((title) => (
                <div
                  key={title.id}
                  className="flex items-start gap-4 p-3 rounded-lg border border-white/10 bg-white/5 hover:border-[#8BF5E6]/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="text-xs text-muted mb-1 font-mono">{title.key}</div>
                    {editingKey === title.key ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editValues.hi}
                          onChange={(e) => setEditValues({ ...editValues, hi: e.target.value })}
                          placeholder="Hindi text"
                          className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 placeholder:text-white/60 bg-white/5 backdrop-blur-sm text-white"
                          aria-label="Hindi title"
                        />
                        <input
                          type="text"
                          value={editValues.en}
                          onChange={(e) => setEditValues({ ...editValues, en: e.target.value })}
                          placeholder="English text (optional)"
                          className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 placeholder:text-white/60 bg-white/5 backdrop-blur-sm text-white"
                          aria-label="English title"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(title.key, title.section)}
                            disabled={saving}
                            className="neon-button px-4 py-1 rounded text-sm disabled:opacity-50"
                          >
                            {saving ? 'सेव हो रहा है...' : 'सेव करें'}
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="px-4 py-1 rounded text-sm border border-white/20 text-white hover:bg-white/10 disabled:opacity-50"
                          >
                            रद्द करें
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-white font-medium mb-1">{title.value_hi}</div>
                        {title.value_en && (
                          <div className="text-sm text-secondary">{title.value_en}</div>
                        )}
                      </div>
                    )}
                  </div>
                  {editingKey !== title.key && (
                    <button
                      onClick={() => handleEdit(title)}
                      className="neon-button px-3 py-1 rounded text-sm"
                      aria-label={`Edit ${title.key}`}
                    >
                      संपादित करें
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


