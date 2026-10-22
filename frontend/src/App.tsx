import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
const OverviewTab = lazy(() => import('./components/OverviewTab').then((module) => ({ default: module.OverviewTab })));
const LiveChatTab = lazy(() => import('./components/LiveChatTab').then((module) => ({ default: module.LiveChatTab })));
const SimulatorTab = lazy(() => import('./components/SimulatorTab').then((module) => ({ default: module.SimulatorTab })));
const ClinicalTab = lazy(() => import('./components/ClinicalTab').then((module) => ({ default: module.ClinicalTab })));
const TicketsTab = lazy(() => import('./components/TicketsTab').then((module) => ({ default: module.TicketsTab })));
const SettingsTab = lazy(() => import('./components/SettingsTab').then((module) => ({ default: module.SettingsTab })));
const PatientsTab = lazy(() => import('./components/PatientsTab').then((module) => ({ default: module.PatientsTab })));
const AgendaTab = lazy(() => import('./components/AgendaTab').then((module) => ({ default: module.AgendaTab })));
const PreparationsTab = lazy(() => import('./components/PreparationsTab').then((module) => ({ default: module.PreparationsTab })));
const WhatsAppQrModal = lazy(() => import('./components/WhatsAppQrModal').then((module) => ({ default: module.WhatsAppQrModal })));
import { fetchMetrics, DashboardMetrics, fetchWhatsAppStatus, WhatsAppStatus, socket, fetchCurrentUser, logout, AuthUser } from './lib/api';
import { AlertTriangle, WifiOff, X } from 'lucide-react';
import { LoginScreen } from './components/LoginScreen';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState(false);
  const [criticalNotice, setCriticalNotice] = useState<{ patient: string; description: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser().then(setAuthUser).catch(() => setAuthUser(null)).finally(() => setAuthLoading(false));
  }, []);

  const loadData = async () => {
    try {
      const [m, ws] = await Promise.all([fetchMetrics(), fetchWhatsAppStatus()]);
      setMetrics(m);
      setWaStatus(ws);
      setConnectionError(false);
    } catch (err) {
      console.error('Error cargando datos iniciales:', err);
      setConnectionError(true);
    }
  };

  useEffect(() => {
    if (!authUser) return;
    loadData();

    socket.on('metrics_updated', (newMetrics: DashboardMetrics) => {
      setMetrics(newMetrics);
    });

    socket.on('whatsapp_status', (status: WhatsAppStatus) => {
      setWaStatus(status);
    });

    socket.on('critical_alarm', (ticket) => {
      loadData();
      setCriticalNotice({
        patient: ticket.contactName || 'Paciente',
        description: ticket.description,
      });
    });
    socket.on('connect_error', () => setConnectionError(true));
    socket.on('connect', () => {
      setConnectionError(false);
      loadData();
    });

    return () => {
      socket.off('metrics_updated');
      socket.off('whatsapp_status');
      socket.off('critical_alarm');
      socket.off('connect_error');
      socket.off('connect');
    };
  }, [authUser]);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-[#051650] text-sm font-semibold text-white">Validando sesión…</div>;
  if (!authUser) return <LoginScreen onAuthenticated={(user) => { setAuthUser(user); socket.connect(); }} />;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased selection:bg-[#00A3E0] selection:text-white">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        criticalAlarmsCount={metrics?.criticalAlarms || 0}
        requiresAgentCount={metrics?.requiresAgent || 0}
        isDbConnected={metrics?.isDatabaseConnected || false}
        isDbAvailable={metrics?.isDatabaseAvailable || false}
        waStatus={waStatus}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        onCloseMobile={() => setMobileNavOpen(false)}
        user={authUser}
        onLogout={async () => { await logout(); socket.disconnect(); setAuthUser(null); }}
      />

      <div className={`flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ${sidebarCollapsed ? 'lg:pl-[88px]' : 'lg:pl-72'}`}>
        <TopBar
          activeTab={activeTab}
          criticalAlarmsCount={metrics?.criticalAlarms || 0}
          requiresAgentCount={metrics?.requiresAgent || 0}
          waStatus={waStatus}
          onOpenQrModal={() => setIsQrModalOpen(true)}
          onNavigateTab={setActiveTab}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        <div className="px-6 pt-4 sm:px-8 space-y-3" aria-live="polite">
          {connectionError && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-xs">
              <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Conexión con el backend interrumpida</p>
                <p className="mt-0.5 text-xs text-amber-800">Los datos pueden estar desactualizados. Revisa el servidor y vuelve a intentar.</p>
              </div>
            </div>
          )}
          {criticalNotice && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-950 shadow-xs">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Alerta clínica postquirúrgica · {criticalNotice.patient}</p>
                <p className="mt-0.5 text-xs text-red-900">{criticalNotice.description}</p>
                <button onClick={() => setActiveTab('tickets')} className="mt-2 text-xs font-bold underline underline-offset-2 text-red-700 hover:text-red-900 cursor-pointer">Abrir alarmas y tickets</button>
              </div>
              <button onClick={() => setCriticalNotice(null)} className="rounded-lg p-1 text-red-700 hover:bg-red-100 cursor-pointer" aria-label="Cerrar aviso de alerta clínica">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm font-medium text-slate-500">Cargando módulo…</div>}>
          <div key={activeTab} className="tab-transition">
            {activeTab === 'overview' && (
              <OverviewTab metrics={metrics} onNavigateTab={setActiveTab} />
            )}
            {activeTab === 'chat' && <LiveChatTab />}
            {activeTab === 'simulator' && <SimulatorTab />}
            {activeTab === 'clinical' && <ClinicalTab />}
            {activeTab === 'patients' && <PatientsTab />}
            {activeTab === 'agenda' && <AgendaTab />}
            {activeTab === 'preparations' && <PreparationsTab />}
            {activeTab === 'tickets' && <TicketsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
          </Suspense>
        </main>

        <footer className="border-t border-slate-200/90 bg-white py-4 px-8 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
          <span className="font-semibold text-slate-700">Hospital Universitario Nacional de Colombia (HUN) · Nit 900.865.029-4</span>
        </footer>
      </div>

      {/* Modal de vinculación QR WhatsApp */}
      <Suspense fallback={null}><WhatsAppQrModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} /></Suspense>
    </div>
  );
}

export default App;
