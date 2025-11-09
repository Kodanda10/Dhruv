/**
 * CommandView Dashboard Component
 * 
 * Phase 7 & 8 Implementation: Admin Control Panel & CMS
 * - System Health Overview (7.1)
 * - Dynamic Title & Header Editor (7.2)
 * - Analytics Module Toggle System (7.3)
 * - Telemetry & Logs Dashboard (7.4)
 * - Database & Pipeline Monitor (7.5)
 * - Config Export/Import (7.7)
 * - Telemetry Extensions (Phase 8)
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import SystemHealthCards from './SystemHealthCards';
import TitleEditor from './TitleEditor';
import ModuleToggle from './ModuleToggle';
import TelemetryDashboard from './TelemetryDashboard';
import PipelineMonitor from './PipelineMonitor';
import ConfigManagement from './ConfigManagement';
// Phase 8: Telemetry Extensions
import LatencyVisualization from '../telemetry/LatencyVisualization';
import TraceExplorerModal from '../telemetry/TraceExplorerModal';
import ErrorTable from '../telemetry/ErrorTable';
import TraceHeatmap from '../telemetry/TraceHeatmap';
import TraceStream from '../telemetry/TraceStream';

export default function CommandViewDashboard() {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);

  const handleTraceClick = (traceId: string) => {
    setSelectedTraceId(traceId);
    setIsTraceModalOpen(true);
  };

  const handleCloseTraceModal = () => {
    setIsTraceModalOpen(false);
    setSelectedTraceId(null);
  };

  return (
    <div className="space-y-8">
      {/* Phase 7.1: System Health Overview Dashboard */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
          🩺 सिस्टम स्वास्थ्य अवलोकन
          <span className="text-sm font-normal text-secondary">(System Health Overview)</span>
        </h2>
        <SystemHealthCards />
      </motion.section>

      {/* Phase 7.2: Dynamic Title & Header Editor */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut', delay: 0.1 }}
      >
        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
          ✏️ शीर्षक संपादक
          <span className="text-sm font-normal text-secondary">(Title & Header Editor)</span>
        </h2>
        <TitleEditor />
      </motion.section>

      {/* Phase 7.3: Analytics Module Toggle System */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut', delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
          🔀 एनालिटिक्स मॉड्यूल टॉगल
          <span className="text-sm font-normal text-secondary">(Analytics Module Toggle)</span>
        </h2>
        <ModuleToggle />
      </motion.section>

      {/* Phase 7.4: Telemetry & Logs Dashboard */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut', delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
          📊 टेलीमेट्री और लॉग
          <span className="text-sm font-normal text-secondary">(Telemetry & Logs)</span>
        </h2>
        <TelemetryDashboard />
      </motion.section>

      {/* Phase 7.5: Database & Pipeline Monitor */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut', delay: 0.4 }}
      >
        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
          🔄 डेटाबेस और पाइपलाइन मॉनिटर
          <span className="text-sm font-normal text-secondary">(Database & Pipeline Monitor)</span>
        </h2>
        <PipelineMonitor />
      </motion.section>

      {/* Phase 7.7: Config Export/Import */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut', delay: 0.5 }}
      >
        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
          ⚙️ कॉन्फ़िग निर्यात/आयात
          <span className="text-sm font-normal text-secondary">(Config Export/Import)</span>
        </h2>
        <ConfigManagement />
      </motion.section>

      {/* Phase 8: Telemetry Extensions */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut', delay: 0.6 }}
      >
        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
          🔬 टेलीमेट्री एक्सटेंशन
          <span className="text-sm font-normal text-secondary">(Telemetry Extensions)</span>
        </h2>
        <div className="space-y-6">
          {/* Phase 8.2: API Latency Visualization */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              📊 API Latency Visualization
            </h3>
            <LatencyVisualization />
          </div>

          {/* Phase 8.4: Error Snapshot Panel */}
          <div>
            <ErrorTable onTraceClick={handleTraceClick} />
          </div>

          {/* Phase 8.5: Latency Heatmap */}
          <div>
            <TraceHeatmap />
          </div>

          {/* Phase 8.6: Recent Trace Stream */}
          <div>
            <TraceStream onTraceClick={handleTraceClick} />
          </div>
        </div>
      </motion.section>

      {/* Phase 8.3: Trace Explorer Modal */}
      <TraceExplorerModal
        traceId={selectedTraceId}
        isOpen={isTraceModalOpen}
        onClose={handleCloseTraceModal}
      />
    </div>
  );
}
