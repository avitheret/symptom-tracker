import { useState } from 'react';
import { Shield, ArrowLeft, ScrollText, BarChart3, Plug, FileText, HardDrive } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { AdminGate } from './admin/AdminGate';
import { TabBar } from './ui';
import type { TabItem } from './ui';
import AdminActivityLog from './admin/AdminActivityLog';
import AdminStats from './admin/AdminStats';
import AdminAPI from './admin/AdminAPI';
import AdminContent from './admin/AdminContent';
import AdminSystem from './admin/AdminSystem';

// ── Tab definitions ─────────────────────────────────────────────────────────

type AdminTab = 'activity' | 'statistics' | 'api' | 'content' | 'system';

const TABS: TabItem<AdminTab>[] = [
  { id: 'activity',   label: 'Activity',   icon: <ScrollText size={14} /> },
  { id: 'statistics', label: 'Statistics',  icon: <BarChart3 size={14} /> },
  { id: 'api',        label: 'API',         icon: <Plug size={14} /> },
  { id: 'content',    label: 'Content',     icon: <FileText size={14} /> },
  { id: 'system',     label: 'System',      icon: <HardDrive size={14} /> },
];

const TAB_COMPONENTS: Record<AdminTab, React.ComponentType> = {
  activity:   AdminActivityLog,
  statistics: AdminStats,
  api:        AdminAPI,
  content:    AdminContent,
  system:     AdminSystem,
};

// ── Component ───────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const { setView } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('activity');

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <AdminGate>
      <div className="min-h-screen bg-slate-50">
        {/* Title bar */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield size={20} className="text-slate-600" />
              <h1 className="text-lg font-semibold text-slate-800">Admin Panel</h1>
            </div>
            <button
              onClick={() => setView('dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                         text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to App
            </button>
          </div>
        </div>

        {/* Tab bar + content */}
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          <TabBar<AdminTab>
            tabs={TABS}
            active={activeTab}
            onChange={setActiveTab}
            compact
          />

          <ActiveComponent />
        </div>
      </div>
    </AdminGate>
  );
}
