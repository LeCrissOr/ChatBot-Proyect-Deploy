import React from 'react';
import {
  Activity,
  MessageSquare,
  Sparkles,
  Calendar,
  CalendarDays,
  ShieldAlert,
  Settings,
  CheckCircle2,
  QrCode,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Users,
  LogOut,
  FileText,
} from 'lucide-react';
import { WhatsAppStatus } from '../lib/api';
import { AuthUser } from '../lib/api';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  criticalAlarmsCount: number;
  requiresAgentCount: number;
  isDbConnected: boolean;
  isDbAvailable: boolean;
  waStatus: WhatsAppStatus | null;
  onOpenQrModal: () => void;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  user: AuthUser;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  criticalAlarmsCount,
  requiresAgentCount,
  isDbConnected,
  isDbAvailable,
  waStatus,
  onOpenQrModal,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  user,
  onLogout,
}) => {
  const isConnected = waStatus?.status === 'CONNECTED';

  const menuItems = [
    { id: 'overview', label: 'Resumen & KPIs', icon: Activity },
    {
      id: 'chat',
      label: 'Bandeja en Vivo',
      icon: MessageSquare,
      badge: requiresAgentCount > 0 ? requiresAgentCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    { id: 'simulator', label: 'Simulador WhatsApp', icon: Sparkles },
    { id: 'patients', label: 'Pacientes', icon: Users },
    { id: 'agenda', label: 'Agenda Médica', icon: CalendarDays },
    { id: 'preparations', label: 'Preparaciones & Labs', icon: FileText },
    { id: 'clinical', label: 'Citas & Cotizaciones', icon: Calendar },
    {
      id: 'tickets',
      label: 'Alarmas & Tickets',
      icon: ShieldAlert,
      badge: criticalAlarmsCount > 0 ? criticalAlarmsCount : undefined,
      badgeColor: 'bg-red-500 text-white animate-pulse',
    },
    { id: 'settings', label: 'Configuración Meta', icon: Settings },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col justify-between overflow-hidden bg-[#051650] p-5 text-white shadow-[12px_0_40px_rgba(5,22,80,0.18)] transition-[width,transform] duration-300 border-r border-white/10 select-none lg:translate-x-0 ${
        collapsed ? 'w-[88px]' : 'w-72'
      } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      aria-label="Navegación principal"
    >
      {/* Resplandor Azul Atmosférico */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-14 bottom-[-18px] h-[360px] bg-[#2979ff]/20 blur-3xl"
      />

      {/* Marca de Agua con Fotografía de la Fachada HUN */}
      <div className="pointer-events-none absolute inset-x-[-18%] bottom-[-34px] z-0 h-[370px] overflow-hidden opacity-100 [mask-image:linear-gradient(to_top,black_0%,black_36%,transparent_100%)]">
        <img
          src="/LeBanner.jpeg"
          alt=""
          className="h-full w-full object-cover object-center brightness-75 contrast-95 saturate-90 opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#051650]/55 via-[#051650]/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#051650]/60 via-[#051650]/10 to-[#051650]/35" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* Cabecera de Marca Oficial HUN */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-5">
          <div className={`${collapsed ? 'items-center mx-auto' : 'items-start'} min-w-0 flex-1 transition-all duration-300`}>
            <img
              src="/logo_1_white.png"
              alt="Hospital Universitario Nacional de Colombia"
              className={`${collapsed ? 'h-10' : 'h-16'} w-auto max-w-full object-contain object-left transition-all duration-300`}
            />

            {/* Título HUNiX + Pill PARTICULARES */}
            <div className={`${collapsed ? 'justify-center' : 'items-end'} hunix-brand-hover mt-2 flex gap-1.5`}>
              <p className={`${collapsed ? 'text-base' : 'text-xl'} font-black tracking-[-0.095em] text-white transition-all duration-300`}>
                <span className="hunix-pulse">HUNiX</span>
              </p>
              {!collapsed && (
                <span className="mb-0.5 rounded-full border border-[#4d9bec]/30 bg-[#4d9bec]/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-[.12em] text-[#b7d9ff]">
                  Particulares
                </span>
              )}
            </div>

            {/* Subrayado Cian de Acento */}
            {!collapsed && (
              <div className="mt-2 h-0.5 w-10 rounded-full bg-[#4d9bec] shadow-[0_0_14px_rgba(77,155,236,0.75)]" />
            )}
          </div>

          <button
            onClick={onCloseMobile}
            className="rounded-xl border border-white/10 p-2 text-slate-200 hover:bg-white/10 lg:hidden cursor-pointer"
            aria-label="Cerrar navegación"
          >
            <X size={20} strokeWidth={1.5} />
          </button>

          <button
            onClick={onToggleCollapse}
            className="hidden rounded-xl border border-white/10 p-2 text-slate-200 hover:bg-white/10 lg:block cursor-pointer"
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.5} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Tarjeta de Sesión Activa */}
        {!collapsed && (
          <div className="relative z-10 mt-5 rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-widest text-[#8ca1c5] font-semibold">Sesión activa</p>
            <p className="mt-1.5 truncate font-bold text-white text-base leading-tight">{user.name}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-[#9ec9ef]">
              {user.role === 'ADMIN' ? 'Administrador Clínico' : 'Auxiliar Asistencial'}
            </p>
          </div>
        )}

        {/* Menú de Navegación */}
        <nav className="relative z-10 mt-5 space-y-1.5" aria-label="Módulos">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onCloseMobile();
                }}
                title={collapsed ? item.label : undefined}
                className={`flex w-full items-center ${
                  collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3.5 py-3'
                } rounded-xl text-left text-[13px] transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#1d58d8] font-bold text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)] ring-1 ring-[#5da6ff]/40'
                    : 'text-[#bdc9e2] hover:bg-white/10 hover:text-white font-medium'
                }`}
              >
                <Icon size={18} strokeWidth={1.6} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="truncate flex-1">{item.label}</span>
                )}
                {!collapsed && item.badge !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Zona Inferior: Widgets de Conexión & Cerrar Sesión */}
      <div className="relative z-10 pt-4 mt-auto border-t border-white/10 space-y-3">
        {/* Indicadores Técnicos de Estado */}
        {!collapsed && (
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs backdrop-blur-xs">
            {/* WhatsApp Cloud API */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-cyan-200">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                WhatsApp API
              </span>
              <button
                onClick={onOpenQrModal}
                className="text-[10px] font-bold text-cyan-300 hover:text-white underline cursor-pointer"
              >
                {isConnected ? `+${waStatus?.connectedPhone?.slice(-4)}` : 'Vincular'}
              </button>
            </div>

            {/* PostgreSQL 16 */}
            <div className="flex items-center justify-between text-[11px] text-cyan-200/90 pt-1 border-t border-white/5">
              <span className="flex items-center gap-1.5">
                <Database size={13} className="text-cyan-300" strokeWidth={1.5} />
                PostgreSQL 16
              </span>
              <span className={`text-[10px] font-mono font-bold ${isDbConnected ? 'text-emerald-300' : 'text-slate-400'}`}>
                {isDbConnected ? 'Conectado' : 'Memoria'}
              </span>
            </div>
          </div>
        )}

        {/* Botón Cerrar Sesión */}
        <button
          onClick={onLogout}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className={`flex w-full items-center ${
            collapsed ? 'justify-center' : 'gap-3'
          } rounded-xl border border-transparent px-3 py-2.5 text-[13px] text-[#bdc9e2] hover:border-rose-300/20 hover:bg-rose-500/15 hover:text-white transition-colors cursor-pointer`}
        >
          <LogOut size={18} strokeWidth={1.5} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
};
