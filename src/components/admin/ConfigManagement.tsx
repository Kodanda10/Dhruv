/**
 * Config Management Component
 * Phase 7.7: Config Export/Import
 * Allows exporting and importing CMS configuration
 */

'use client';

import { useState } from 'react';

export default function ConfigManagement() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/cms/export');
      if (!response.ok) {
        throw new Error('Failed to export configuration');
      }
      const result = await response.json();
      if (result.success && result.data) {
        // Download as JSON file
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cms-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Configuration exported successfully' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }

    setImporting(true);
    setMessage(null);
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);

      const response = await fetch('/api/cms/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to import configuration');
      }

      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Configuration imported successfully. Backup created.' });
        setImportFile(null);
        // Reset file input
        const fileInput = document.getElementById('import-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="glass-section-card p-6">
      <h3 className="text-xl font-bold text-white mb-4">कॉन्फ़िग निर्यात/आयात</h3>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg border ${
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Export Section */}
        <div className="border-b border-white/10 pb-6">
          <h4 className="text-lg font-semibold text-white mb-3">निर्यात कॉन्फ़िग</h4>
          <p className="text-sm text-secondary mb-4">
            सभी CMS कॉन्फ़िगरेशन को JSON फ़ाइल के रूप में डाउनलोड करें
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="neon-button px-6 py-2 rounded disabled:opacity-50"
          >
            {exporting ? 'निर्यात हो रहा है...' : 'कॉन्फ़िग निर्यात करें'}
          </button>
        </div>

        {/* Import Section */}
        <div>
          <h4 className="text-lg font-semibold text-white mb-3">आयात कॉन्फ़िग</h4>
          <p className="text-sm text-secondary mb-4">
            JSON फ़ाइल से कॉन्फ़िगरेशन आयात करें (स्वचालित बैकअप बनाया जाएगा)
          </p>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="import-file" className="block text-sm text-secondary mb-2">
                JSON फ़ाइल चुनें
              </label>
              <input
                id="import-file"
                type="file"
                accept=".json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 bg-white/5 backdrop-blur-sm text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-[#8BF5E6]/20 file:text-white file:cursor-pointer"
              />
            </div>
            <button
              onClick={handleImport}
              disabled={importing || !importFile}
              className="neon-button px-6 py-2 rounded disabled:opacity-50"
            >
              {importing ? 'आयात हो रहा है...' : 'कॉन्फ़िग आयात करें'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


