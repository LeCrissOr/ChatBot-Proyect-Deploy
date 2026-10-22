import React from 'react';
import {
  Search,
  ShieldAlert,
  Bell,
  CheckCircle2,
  QrCode,
  Building,
  User,
  Menu,
  Settings,
} from 'lucide-react';
import { WhatsAppStatus } from '../lib/api';

interface TopBarProps {
  activeTab: string;
  criticalAlarmsCount: number;
  requiresAgentCount: number;
  waStatus: WhatsAppStatus | null;
  onOpenQrModal: () => void;
  onNavigateTab: (tab: string) => void;
  onOpenMobileNav: () => void;
}

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: {
    title: 'Panel de Control & KPIs',
    subtitle: 'Métricas de atención en tiempo real · Flujo Paciente Particular v1.0',
  },
  chat: {
    title: 'Bandeja de Entrada en Vivo (WhatsApp)',
    subtitle: 'Monitoreo de conversaciones, derivaciones asistidas y triaje clínico',
  },
  simulator: {
    title: 'Simulador WhatsApp HUN',
    subtitle: 'Entorno de pruebas interactivo del árbol conversacional F-01 a F-04',
  },
  clinical: {
    title: 'Citas Médicas & Cotizaciones Quirúrgicas',
    subtitle: 'Agenda confirmada (F-01 / F-03) y solicitudes para valoración de enfermería (F-02)',
  },
  patients: {
    title: 'Directorio de Pacientes',
    subtitle: 'Datos de pacientes registrados y consultados desde PostgreSQL',
  },
  agenda: {
    title: 'Agenda Médica Institucional 2026',
    subtitle: 'Gestión de turnos médicos, disponibilidad de consultorios y novedades de agenda del HUN',
  },
  tickets: {
    title: 'Registro de Excepciones & Alarmas Clínicas',
    subtitle: 'Tickets automáticos para auxiliares, citas prioritarias y seguimiento postoperatorio',
  },
  settings: {
    title: 'Configuración & Enlace Meta Cloud',
    subtitle: 'Credenciales del Webhook oficial, tokens de acceso y estado de los servidores',
  },
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  criticalAlarmsCount,
  requiresAgentCount,
  waStatus,
  onOpenQrModal,
  onNavigateTab,
  onOpenMobileNav,
}) => {
  const isConnected = waStatus?.status === 'CONNECTED';
  const info = TAB_TITLES[activeTab] || {
    title: 'Hospital Universitario Nacional',
    subtitle: 'Sistema de Atención al Paciente Particular',
  };

  return (
    <header className="bg-white border-b border-slate-200/90 h-16 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Sección Izquierda: Título y Contexto */}
      <div className="flex min-w-0 items-center space-x-3 sm:space-x-4">
        <button onClick={onOpenMobileNav} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Abrir menú">
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <div>
          <h2 className="flex items-center space-x-2 truncate text-sm font-black tracking-tight text-slate-900 sm:text-base">
            <span className="truncate">{info.title}</span>
            <span className="hidden shrink-0 rounded-full border border-[#4d9bec]/30 bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-[#051650] sm:inline-flex shadow-2xs">
              HUNiX · Particulares
            </span>
          </h2>
          <p className="text-xs text-slate-500 hidden sm:block">
            {info.subtitle}
          </p>
        </div>
      </div>

      {/* Sección Derecha: Buscador, Alertas y Perfil */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Barra de Búsqueda Rápida */}
        <div className="relative hidden md:block w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={1.5} />
            <input
              type="text"
              aria-label="Buscar paciente o documento"
              placeholder="Buscar paciente o doc..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00A3E0]/30 focus:border-[#00A3E0] transition placeholder:text-slate-400"
          />
        </div>

        {/* Botón Estado WhatsApp QR */}
        <button
          onClick={onOpenQrModal}
          className={`flex items-center space-x-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl border transition shadow-xs cursor-pointer ${
            isConnected
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
              : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 animate-pulse'
          }`}
        >
          {isConnected ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
              <span className="hidden sm:inline">WhatsApp:</span>
              <strong>+{waStatus?.connectedPhone}</strong>
            </>
          ) : (
            <>
              <QrCode className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Vincular WhatsApp</span>
            </>
          )}
        </button>

        {/* Botón Acceso Rápido Configuración Meta */}
        <button
          onClick={() => onNavigateTab('settings')}
          className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition shadow-xs cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-[#002B49] text-white border-[#002B49]'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Configuración Meta WhatsApp Cloud API y Webhook"
        >
          <Settings className="w-3.5 h-3.5 text-[#00A3E0]" strokeWidth={1.5} />
          <span className="hidden md:inline">Configuración Meta</span>
        </button>

        {/* Alarma Crítica Flotante */}
        {criticalAlarmsCount > 0 && (
          <button
            onClick={() => onNavigateTab('tickets')}
            className="flex items-center space-x-1.5 text-xs text-red-700 bg-red-100 border border-red-300 px-3.5 py-1.5 rounded-xl font-black animate-bounce shadow-xs cursor-pointer"
            title="Ver alarmas postquirúrgicas críticas"
          >
            <ShieldAlert className="w-4 h-4 text-red-600" strokeWidth={1.5} />
            <span>{criticalAlarmsCount} Alarma Qx</span>
          </button>
        )}

      </div>
    </header>
  );
};
