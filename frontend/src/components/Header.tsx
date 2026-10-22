import React from 'react';
import { Activity, ShieldAlert, Sparkles, Database, QrCode, CheckCircle2 } from 'lucide-react';
import { WhatsAppStatus } from '../lib/api';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  criticalAlarmsCount: number;
  requiresAgentCount: number;
  isDbConnected: boolean;
  waStatus: WhatsAppStatus | null;
  onOpenQrModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  criticalAlarmsCount,
  requiresAgentCount,
  isDbConnected,
  waStatus,
  onOpenQrModal,
}) => {
  const tabs = [
    { id: 'overview', label: 'Resumen & KPIs', icon: Activity },
    {
      id: 'chat',
      label: 'Bandeja en Vivo',
      badge: requiresAgentCount > 0 ? requiresAgentCount : undefined,
      badgeColor: 'bg-amber-500',
    },
    { id: 'simulator', label: 'Simulador WhatsApp', icon: Sparkles },
    { id: 'clinical', label: 'Citas & Cotizaciones' },
    {
      id: 'tickets',
      label: 'Alarmas & Tickets',
      badge: criticalAlarmsCount > 0 ? criticalAlarmsCount : undefined,
      badgeColor: 'bg-red-500',
    },
    { id: 'settings', label: 'Configuración Meta' },
  ];

  const isConnected = waStatus?.status === 'CONNECTED';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-xl shadow-md">
              HUN
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-slate-800 text-lg leading-tight">
                  Hospital Universitario Nacional
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  Paciente Particular v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500">
                WhatsApp Business Cloud & Web · Flujo Oficial
              </p>
            </div>
          </div>

          {/* System Indicators */}
          <div className="flex items-center space-x-3">
            {/* Botón Vincular WhatsApp con QR */}
            <button
              onClick={onOpenQrModal}
              className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition shadow-sm ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 animate-pulse'
              }`}
            >
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp: <strong>+{waStatus?.connectedPhone || 'Conectado'}</strong></span>
                </>
              ) : (
                <>
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Vincular WhatsApp (Escanear QR)</span>
                </>
              )}
            </button>

            <div className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-full">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>DB: <strong>{isDbConnected ? 'PostgreSQL' : 'Dev Sync'}</strong></span>
            </div>

            {criticalAlarmsCount > 0 && (
              <div className="flex items-center space-x-1.5 text-xs text-red-700 bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-full font-medium animate-bounce">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>{criticalAlarmsCount} Alarma Qx</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-2 border-t border-slate-100 overflow-x-auto py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.icon && <tab.icon className="w-4 h-4" />}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 text-xs text-white px-2 py-0.5 rounded-full font-bold ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
