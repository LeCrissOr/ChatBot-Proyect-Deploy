import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  Search,
  Filter,
  Upload,
  RefreshCw,
  User,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Table,
  CheckCircle2,
  Stethoscope,
  Building2,
  ShieldAlert,
  Eye,
  X,
} from 'lucide-react';
import {
  fetchAgendaList,
  fetchAgendaCalendar,
  fetchAgendaFilters,
  fetchAgendaAbsences,
  fetchAgendaStats,
  fetchAppointments,
  syncAgendaEndpoint,
  Appointment,
  MedicalAgendaItem,
  MedicalAbsenceItem,
  CalendarMonthData,
  AgendaStats,
  AgendaFilters,
  socket,
} from '../lib/api';
import { translatePaymentStatus, translateAppointmentStatus, translateScheduleType } from '../lib/translations';
import { AgendaDetailDrawer } from './AgendaDetailDrawer';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const AgendaTab: React.FC = () => {
  // Estados de vista y navegación
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'absences'>('calendar');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Estados de datos
  const [stats, setStats] = useState<AgendaStats | null>(null);
  const [filters, setFilters] = useState<AgendaFilters>({ specialties: [], doctors: [], offices: [], days: [] });
  const [calendarData, setCalendarData] = useState<CalendarMonthData | null>(null);
  const [agendaItems, setAgendaItems] = useState<MedicalAgendaItem[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [absences, setAbsences] = useState<MedicalAbsenceItem[]>([]);

  // Estados de filtrado interactivo
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>('');
  const [selectedScheduleType, setSelectedScheduleType] = useState<string>('ALL');
  const [selectedAppointmentStatus, setSelectedAppointmentStatus] = useState<string>('ALL');

  // Modales y Drawer
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<MedicalAgendaItem | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados de sincronización del Endpoint Hosvital
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Cargar filtros, estadísticas y citas iniciales
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [st, fl, apts] = await Promise.all([
        fetchAgendaStats(),
        fetchAgendaFilters(),
        fetchAppointments().catch(() => []),
      ]);
      setStats(st);
      setFilters(fl);
      setAppointmentsList(apts);
    } catch (err) {
      console.error('Error cargando iniciales de agenda:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos de calendario según mes y filtros
  const loadCalendar = async () => {
    try {
      setLoading(true);
      const data = await fetchAgendaCalendar({
        month: selectedMonth,
        year: selectedYear,
        specialty: selectedSpecialty || undefined,
        doctor: selectedDoctor || undefined,
        search: searchQuery.trim() || undefined,
      });
      setCalendarData(data);
    } catch (err) {
      console.error('Error cargando calendario:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar lista paginada de agenda
  const loadTableData = async () => {
    try {
      setLoading(true);
      const res = await fetchAgendaList({
        page: currentPage,
        limit: 25,
        search: searchQuery.trim() || undefined,
        specialty: selectedSpecialty || undefined,
        doctor: selectedDoctor || undefined,
        dayOfWeek: selectedDayOfWeek || undefined,
        scheduleType: selectedScheduleType !== 'ALL' ? selectedScheduleType : undefined,
      });
      setAgendaItems(res.items);
      setTotalItems(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error('Error cargando tabla de agenda:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar ausencias
  const loadAbsences = async () => {
    try {
      setLoading(true);
      const res = await fetchAgendaAbsences({
        specialty: selectedSpecialty || undefined,
        doctor: selectedDoctor || undefined,
        search: searchQuery.trim() || undefined,
      });
      setAbsences(res);
    } catch (err) {
      console.error('Error cargando ausencias:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sincronización manual en tiempo real con el Endpoint de Hosvital
  const handleSyncHosvital = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    setSyncMessage('Sincronizando con Hosvital...');

    try {
      const res = await syncAgendaEndpoint();
      await loadInitialData();
      if (viewMode === 'calendar') await loadCalendar();
      if (viewMode === 'table') await loadTableData();
      if (viewMode === 'absences') await loadAbsences();

      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(timeNow);
      setSyncStatus('success');

      const docs = res?.stats?.totalDoctors || stats?.totalDoctors;
      const schedules = res?.stats?.totalSchedules || stats?.totalSchedules;
      if (docs && schedules) {
        setSyncMessage(`¡Sincronizado! (${docs} esp. • ${schedules} turnos)`);
      } else {
        setSyncMessage('¡Sincronizado con éxito!');
      }

      setTimeout(() => {
        setSyncStatus('idle');
      }, 4500);
    } catch (err: any) {
      console.error('Error sincronizando endpoint Hosvital:', err);
      setSyncStatus('error');
      setSyncMessage(err?.response?.data?.error || err?.message || 'Error al sincronizar');
      setTimeout(() => {
        setSyncStatus('idle');
      }, 5000);
    }
  };

  // Helpers de normalización y correspondencia
  const normalizeText = (text: string) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/^(dr\(a\)\.|dra\.|dr\.)\s*/i, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const cleanDoctorName = (name: string) => normalizeText(name);

  const matchesAppointmentStatus = (status: string, filter: string) => {
    if (filter === 'ALL') return true;
    const s = (status || '').toUpperCase();
    if (filter === 'CONFIRMED') {
      return s === 'CONFIRMED' || s === 'PAID_VIRTUAL' || s === 'PAY_AT_WINDOW' || s === 'CONFIRMADA';
    }
    if (filter === 'PENDING') {
      return s === 'PENDING_PAYMENT' || s === 'PENDING' || s === 'HELD';
    }
    if (filter === 'RESCHEDULED') {
      return s === 'RESCHEDULED';
    }
    if (filter === 'CANCELLED') {
      return s === 'CANCELLED_BY_USER' || s === 'CANCELLED';
    }
    return false;
  };

  // Citas filtradas según el estado de la cita seleccionado y demás filtros reactivos
  const filteredAppointments = useMemo(() => {
    if (selectedAppointmentStatus === 'ALL') return [];

    return appointmentsList.filter((apt) => {
      if (!matchesAppointmentStatus(apt.status, selectedAppointmentStatus)) return false;

      if (selectedSpecialty && !apt.specialty.toLowerCase().includes(selectedSpecialty.toLowerCase())) {
        return false;
      }

      if (selectedDoctor) {
        const cleanDocParam = cleanDoctorName(selectedDoctor);
        const aptDoc = cleanDoctorName(apt.doctorName);
        if (!aptDoc.includes(cleanDocParam) && !cleanDocParam.includes(aptDoc)) {
          return false;
        }
      }

      if (selectedDayOfWeek) {
        const dateObj = new Date(apt.dateTime);
        const daysMap: Record<number, string> = {
          1: 'LUNES',
          2: 'MARTES',
          3: 'MIERCOLES',
          4: 'JUEVES',
          5: 'VIERNES',
          6: 'SABADO',
          0: 'DOMINGO',
        };
        const aptDay = daysMap[dateObj.getDay()];
        if (aptDay !== selectedDayOfWeek) return false;
      }

      if (searchQuery.trim()) {
        const q = normalizeText(searchQuery);
        const matches =
          normalizeText(apt.doctorName).includes(q) ||
          (apt.contactName && normalizeText(apt.contactName).includes(q)) ||
          (apt.contactPhone && apt.contactPhone.includes(searchQuery.trim())) ||
          normalizeText(apt.specialty).includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [appointmentsList, selectedAppointmentStatus, selectedSpecialty, selectedDoctor, selectedDayOfWeek, searchQuery]);

  // Escuchar WebSocket para actualización en tiempo real cuando se suba un nuevo Excel o se creen citas
  useEffect(() => {
    loadInitialData();

    const handleAgendaUpdate = () => {
      loadInitialData();
      if (viewMode === 'calendar') loadCalendar();
      if (viewMode === 'table') loadTableData();
      if (viewMode === 'absences') loadAbsences();
    };

    const handleAppointmentsUpdate = () => {
      fetchAppointments().then(setAppointmentsList).catch(console.error);
      if (viewMode === 'calendar') loadCalendar();
    };

    socket.on('agenda_updated', handleAgendaUpdate);
    socket.on('appointments_updated', handleAppointmentsUpdate);
    socket.on('appointment_created', handleAppointmentsUpdate);
    socket.on('appointment_updated', handleAppointmentsUpdate);

    return () => {
      socket.off('agenda_updated', handleAgendaUpdate);
      socket.off('appointments_updated', handleAppointmentsUpdate);
      socket.off('appointment_created', handleAppointmentsUpdate);
      socket.off('appointment_updated', handleAppointmentsUpdate);
    };
  }, [viewMode]);

  // Recargar vistas al cambiar dependencias
  useEffect(() => {
    if (viewMode === 'calendar') {
      loadCalendar();
    } else if (viewMode === 'table') {
      loadTableData();
    } else if (viewMode === 'absences') {
      loadAbsences();
    }
  }, [viewMode, selectedMonth, selectedYear, selectedSpecialty, selectedDoctor, selectedDayOfWeek, selectedScheduleType, selectedAppointmentStatus, currentPage]);

  // Manejo de búsqueda con rebote (debounce reactivo para todas las vistas)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewMode === 'calendar') {
        loadCalendar();
      } else if (viewMode === 'table') {
        setCurrentPage(1);
        loadTableData();
      } else if (viewMode === 'absences') {
        loadAbsences();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Navegación de mes
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };

  // Matriz de días del mes para la vista de calendario
  const calendarDays = useMemo(() => {
    const year = selectedYear;
    const month = selectedMonth;
    const firstDayIndex = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0 = Lunes, 6 = Domingo
    const totalDays = new Date(year, month, 0).getDate();

    const cells: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Días de relleno del mes anterior
    const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    // Días del mes actual
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: d, isCurrentMonth: true });
    }

    // Rellenar hasta completar semanas (múltiplos de 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    return cells;
  }, [selectedYear, selectedMonth]);

  const handleOpenDetail = (agendaItem: any) => {
    setDrawerItem(agendaItem);
  };

  const handleOpenAppointmentDoctorDetail = (apt: Appointment) => {
    const cleanDoc = cleanDoctorName(apt.doctorName);
    const existing = agendaItems.find((it) => {
      const itDoc = cleanDoctorName(it.doctorName);
      return itDoc.includes(cleanDoc) || cleanDoc.includes(itDoc);
    });

    if (existing) {
      setDrawerItem(existing);
    } else {
      const aptDate = new Date(apt.dateTime);
      const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
      setDrawerItem({
        id: `apt-drawer-${apt.id}`,
        specialtyName: apt.specialty,
        doctorName: apt.doctorName,
        dayOfWeek: days[aptDate.getDay()] || 'LUNES',
        startTime: aptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        endTime: '—',
        frequencyMinutes: 20,
        scheduleType: 'REGULAR',
        activeDates: [aptDate.toISOString().slice(0, 10)],
        createdAt: apt.createdAt,
        updatedAt: apt.createdAt,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con Título, Botones de Acción y Acceso a Carga de Excel */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#051650] text-[#00A3E0] flex items-center justify-center shadow-sm shrink-0">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Agenda Médica Institucional 2026</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Endpoint Hosvital Activo
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Conexión directa en tiempo real con los Endpoints de Hosvital del Hospital Universitario Nacional de Colombia (sin archivos Excel).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {lastSyncTime && (
            <span className="text-[11px] text-slate-500 hidden sm:inline-flex items-center gap-1.5 font-medium bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Última sinc: {lastSyncTime}</span>
            </span>
          )}

          <button
            onClick={handleSyncHosvital}
            disabled={syncStatus === 'syncing'}
            title={syncStatus === 'error' ? syncMessage : undefined}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all duration-300 ${
              syncStatus === 'syncing'
                ? 'bg-blue-800 text-sky-100 cursor-wait ring-2 ring-blue-400/50'
                : syncStatus === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md ring-2 ring-emerald-400/50'
                : syncStatus === 'error'
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md ring-2 ring-rose-400/50'
                : 'bg-[#051650] hover:bg-[#072173] text-white'
            }`}
          >
            {syncStatus === 'syncing' && (
              <>
                <RefreshCw className="w-4 h-4 text-sky-300 animate-spin" />
                <span>Sincronizando con Hosvital...</span>
              </>
            )}
            {syncStatus === 'success' && (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>{syncMessage || '¡Sincronizado con Éxito!'}</span>
              </>
            )}
            {syncStatus === 'error' && (
              <>
                <AlertTriangle className="w-4 h-4 text-white" />
                <span>{syncMessage || 'Error al Sincronizar'}</span>
              </>
            )}
            {syncStatus === 'idle' && (
              <>
                <RefreshCw className="w-4 h-4 text-sky-400" />
                <span>Sincronizar Endpoint Hosvital</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Estadísticas / KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Especialistas</span>
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{stats.totalDoctors}</p>
            <span className="text-[10px] text-slate-400">Médicos activos en HUN</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Especialidades</span>
              <Stethoscope className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{stats.totalSpecialties}</p>
            <span className="text-[10px] text-slate-400">Rutas asistenciales</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Turnos Totales</span>
              <Calendar className="w-4 h-4 text-sky-600" />
            </div>
            <p className="text-2xl font-black text-blue-700 tracking-tight">{stats.totalSchedules}</p>
            <span className="text-[10px] text-slate-400">Bloques programados</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Turnos Regulares</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-700 tracking-tight">{stats.regularCount}</p>
            <span className="text-[10px] text-slate-400">Agenda ordinaria 2026</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Turnos Adicionales</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-600 tracking-tight">{stats.adicionalCount}</p>
            <span className="text-[10px] text-slate-400">Jornadas complementarias</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Novedades</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-black text-rose-600 tracking-tight">{stats.totalAbsences}</p>
            <span className="text-[10px] text-slate-400">Vacaciones e incapacidades</span>
          </div>
        </div>
      )}

      {/* 3. Barra de Control de Vistas y Filtros */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-4">
        {/* Fila superior: Selector de Modo de Vista y Búsqueda */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Switch de Vistas */}
          <div className="flex p-1 bg-slate-100 rounded-xl w-fit border border-slate-200/80">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'calendar'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
              <span>Vista Calendario</span>
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-emerald-600" />
              <span>Vista Tabla</span>
            </button>

            <button
              onClick={() => setViewMode('absences')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'absences'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Novedades & Ausencias</span>
            </button>
          </div>

          {/* Navegador de Mes (cuando está en Vista Calendario) */}
          {viewMode === 'calendar' && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-2xs">
              <button
                onClick={handleGoToToday}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear()
                    ? 'bg-[#00A3E0] text-white shadow-xs'
                    : 'text-slate-700 hover:text-[#002B49] hover:bg-white border border-transparent hover:border-slate-200'
                }`}
                title="Ir al mes actual (Hoy)"
                aria-label="Ir al mes actual"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Hoy</span>
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white hover:shadow-2xs rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="Mes anterior"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-900 min-w-[130px] text-center px-1">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white hover:shadow-2xs rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="Mes siguiente"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Buscador de Texto */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por médico, especialidad, consultorio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/60 transition cursor-pointer"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Fila inferior: Dropdowns de Filtrado Reactivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Selector Especialidad */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Especialidad:</label>
            <select
              value={selectedSpecialty}
              onChange={(e) => {
                setSelectedSpecialty(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas las especialidades ({filters.specialties.length})</option>
              {filters.specialties.map((esp) => (
                <option key={esp.name} value={esp.name}>
                  {esp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selector Médico */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Médico Especialista:</label>
            <select
              value={selectedDoctor}
              onChange={(e) => {
                setSelectedDoctor(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos los médicos ({filters.doctors.length})</option>
              {filters.doctors.map((doc) => (
                <option key={doc.name} value={doc.name}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Selector Día de la semana */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Día de la semana:</label>
            <select
              value={selectedDayOfWeek}
              onChange={(e) => {
                setSelectedDayOfWeek(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos los días</option>
              {filters.days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Selector Tipo de Turno */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tipo de Agenda:</label>
            <select
              value={selectedScheduleType}
              onChange={(e) => {
                setSelectedScheduleType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Todas las jornadas</option>
              <option value="REGULAR">Agenda Regular</option>
              <option value="ADICIONAL">Agenda Adicional</option>
            </select>
          </div>

          {/* Selector Estado de Cita */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Estado Cita Médica:</label>
            <select
              value={selectedAppointmentStatus}
              onChange={(e) => {
                setSelectedAppointmentStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Todos los estados</option>
              <option value="CONFIRMED">🟢 Confirmadas</option>
              <option value="PENDING">⏳ Pendientes de Pago</option>
              <option value="RESCHEDULED">🔄 Reagendadas</option>
              <option value="CANCELLED">❌ Canceladas por Usuario</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Contenido Principal según el modo de vista */}

      {/* Banner de citas encontradas si se filtra por estado */}
      {selectedAppointmentStatus !== 'ALL' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-emerald-950 font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span>
                Filtrando citas con estado{' '}
                <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300 uppercase tracking-wide">
                  {selectedAppointmentStatus === 'CONFIRMED'
                    ? 'Confirmadas'
                    : selectedAppointmentStatus === 'PENDING'
                    ? 'Pendientes de Pago'
                    : selectedAppointmentStatus === 'RESCHEDULED'
                    ? 'Reagendadas'
                    : 'Canceladas por Usuario'}
                </span>
                : {filteredAppointments.length} cita(s) encontrada(s) en el sistema.
              </span>
              <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                Mostrando únicamente los registros y especialistas que contienen citas con este estado específico.
              </p>
            </div>
          </div>

          {filteredAppointments.length > 0 && (() => {
            const firstAptDate = new Date(filteredAppointments[0].dateTime);
            const aptMonth = firstAptDate.getMonth() + 1;
            const aptYear = firstAptDate.getFullYear();
            if (aptMonth !== selectedMonth || aptYear !== selectedYear) {
              return (
                <button
                  onClick={() => {
                    setSelectedMonth(aptMonth);
                    setSelectedYear(aptYear);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Ir a {MONTH_NAMES[aptMonth - 1]} {aptYear} ({firstAptDate.toLocaleDateString([], { day: 'numeric', month: 'short' })}) →</span>
                </button>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* VISTA 1: CALENDARIO MENSUAL */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Cabecera de días de la semana */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-600 py-2.5">
            {DAY_NAMES.map((name) => (
              <div key={name}>{name}</div>
            ))}
          </div>

          {/* Cuadrícula de días */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 text-xs">
            {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
              const dayData = calendarData?.days[dateStr];
              const rawEvents = dayData?.events || [];
              const rawDayAbsences = dayData?.absences || [];
              const rawDayAppointments = dayData?.appointments || [];

              const queryClean = normalizeText(searchQuery);

              const events = rawEvents.filter((ev) => {
                if (!queryClean) return true;
                return (
                  normalizeText(ev.doctorName).includes(queryClean) ||
                  normalizeText(ev.specialtyName).includes(queryClean) ||
                  (ev.officeCode && ev.officeCode.toLowerCase().includes(queryClean)) ||
                  (ev.modality && normalizeText(ev.modality).includes(queryClean))
                );
              });

              const dayAbsences = rawDayAbsences.filter((ab) => {
                if (!queryClean) return true;
                return (
                  normalizeText(ab.doctorName).includes(queryClean) ||
                  normalizeText(ab.specialty || '').includes(queryClean) ||
                  normalizeText(ab.reason).includes(queryClean)
                );
              });

              const filteredDayAppointments = rawDayAppointments.filter((apt) => {
                if (!matchesAppointmentStatus(apt.status, selectedAppointmentStatus)) return false;
                if (queryClean) {
                  const matches =
                    normalizeText(apt.doctorName).includes(queryClean) ||
                    normalizeText(apt.patientName).includes(queryClean) ||
                    (apt.patientPhone && apt.patientPhone.includes(searchQuery.trim())) ||
                    normalizeText(apt.specialty).includes(queryClean);
                  if (!matches) return false;
                }
                return true;
              });

              // Si se filtra por estado de cita, ocultamos los turnos vacíos de la agenda regular
              const isFilteringStatus = selectedAppointmentStatus !== 'ALL';
              const eventsToDisplay = isFilteringStatus ? [] : events;
              const hasEvents = eventsToDisplay.length > 0;
              const hasAbsences = dayAbsences.length > 0;
              const hasAppointments = filteredDayAppointments.length > 0;
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dateStr}
                  className={`min-h-[140px] p-2 flex flex-col justify-between transition relative ${
                    isToday
                      ? 'bg-sky-50/40 ring-2 ring-inset ring-[#00A3E0]'
                      : isCurrentMonth
                      ? 'bg-white hover:bg-slate-50/50'
                      : 'bg-slate-50/40 text-slate-300'
                  }`}
                >
                  {/* Número de día y contador de turnos */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                          isToday
                            ? 'bg-[#00A3E0] text-white shadow-xs font-black ring-2 ring-[#00A3E0]/30'
                            : isCurrentMonth
                            ? hasEvents || hasAppointments
                              ? 'bg-[#051650] text-white shadow-2xs'
                              : 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {dayNum}
                      </span>
                      {isToday && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#00A3E0] text-white leading-none shadow-2xs">
                          Hoy
                        </span>
                      )}
                    </div>

                    {hasEvents && isCurrentMonth && (
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                        {eventsToDisplay.length} turnos
                      </span>
                    )}
                  </div>

                  {/* Novedades o Ausencias del día */}
                  {hasAbsences && isCurrentMonth && !isFilteringStatus && (
                    <div className="mb-1">
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {dayAbsences.length} ausencia(s)
                      </span>
                    </div>
                  )}

                  {/* Citas Agendadas con el Médico que coinciden con el estado */}
                  {hasAppointments && isCurrentMonth && (
                    <div className="mb-1">
                      <span className="text-[10px] font-black text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                        {filteredDayAppointments.length} cita(s)
                      </span>
                    </div>
                  )}

                  {/* Lista de citas y turnos */}
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {/* Citas coincidentes del día */}
                    {filteredDayAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        onClick={() => {
                          handleOpenAppointmentDoctorDetail({
                            id: apt.id,
                            doctorName: apt.doctorName,
                            specialty: apt.specialty,
                            dateTime: apt.isoDateTime || dateStr,
                            contactName: apt.patientName,
                            contactPhone: apt.patientPhone,
                            price: apt.price,
                            paymentStatus: apt.paymentStatus,
                            status: apt.status,
                            isFirstTime: true,
                            isReferral: !!apt.isReferral,
                            createdAt: apt.isoDateTime || dateStr,
                          });
                        }}
                        className="p-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 cursor-pointer text-[10px] leading-tight transition"
                        title={`Cita: ${apt.patientName} (${apt.timeStr}) - Médico: ${apt.doctorName}`}
                      >
                        <div className="flex items-center justify-between text-emerald-900 font-bold text-xs">
                          <span>🟢 {apt.timeStr}</span>
                          <span className="bg-emerald-200/90 text-emerald-950 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide">
                            {translateAppointmentStatus(apt.status)}
                          </span>
                        </div>
                        <p className="font-extrabold text-slate-900 truncate mt-0.5">
                          👤 {apt.patientName}
                        </p>
                        <span className="text-[9px] text-emerald-800 font-medium truncate block">
                          {apt.doctorName} · {apt.specialty}
                        </span>
                      </div>
                    ))}

                    {/* Turnos de agenda regular/adicional (solo visibles cuando no se filtra por estado de cita) */}
                    {eventsToDisplay.slice(0, Math.max(1, 2 - filteredDayAppointments.length)).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => handleOpenDetail(ev)}
                        className="p-1 rounded-md bg-slate-50 hover:bg-blue-50 border border-slate-200/80 cursor-pointer text-[10px] leading-tight transition group"
                      >
                        <div className="flex items-center justify-between text-slate-500 font-mono text-[9px]">
                          <span>{ev.startTime}</span>
                          {ev.officeCode && <span>Cons. {ev.officeCode}</span>}
                        </div>
                        <p className="font-bold text-slate-800 truncate group-hover:text-blue-700">
                          {ev.doctorName}
                        </p>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-[9px] text-slate-500 truncate">
                            {ev.specialtyName}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {typeof ev.availableCount === 'number' && (
                              <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[8px]">
                                🟢 {ev.availableCount} Disp.
                              </span>
                            )}
                            {typeof ev.occupiedCount === 'number' && ev.occupiedCount > 0 && (
                              <span className="px-1 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[8px]">
                                🔴 {ev.occupiedCount} Ocupado{ev.occupiedCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {eventsToDisplay.length > 2 && (
                      <button
                        onClick={() => {
                          setSelectedSpecialty('');
                          setSelectedDoctor('');
                          setViewMode('table');
                        }}
                        className="text-[10px] text-blue-600 font-semibold hover:underline block text-center w-full pt-0.5"
                      >
                        +{eventsToDisplay.length - 2} turnos más
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISTA 2: TABLA DE CITAS FILTRADAS POR ESTADO ESPECÍFICO */}
      {viewMode === 'table' && selectedAppointmentStatus !== 'ALL' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#051650] text-white uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Especialidad</th>
                  <th className="py-3 px-4">Médico Especialista</th>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Horario Agendado</th>
                  <th className="py-3 px-4">Tarifa / Pago</th>
                  <th className="py-3 px-4">Tipo de Ruta</th>
                  <th className="py-3 px-4">Estado Cita</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400 italic">
                      No se encontraron citas médicas con estado "
                      {selectedAppointmentStatus === 'CONFIRMED'
                        ? 'Confirmadas'
                        : selectedAppointmentStatus === 'PENDING'
                        ? 'Pendientes de Pago'
                        : selectedAppointmentStatus === 'RESCHEDULED'
                        ? 'Reagendadas'
                        : 'Canceladas por Usuario'}
                      " para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-blue-50/40 transition group">
                      <td className="py-3 px-4 font-bold text-slate-900">{apt.specialty}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                            {apt.doctorName.replace(/^(dr\(a\)\.|dra\.|dr\.)\s*/i, '').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block">{apt.doctorName}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {apt.contactName || 'Paciente Particular'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {apt.contactPhone ? `+${apt.contactPhone}` : '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {new Date(apt.dateTime).toLocaleDateString('es-CO', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          ${Number(apt.price).toLocaleString('es-CO')} COP
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          {translatePaymentStatus(apt.paymentStatus)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {apt.isReferral ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold text-xs">
                            Referido F-03
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 font-bold text-xs">
                            Ambulatorio F-01
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {apt.status === 'CANCELLED_BY_USER' || apt.status === 'CANCELLED' ? (
                          <span className="inline-flex items-center text-red-700 bg-red-100 border border-red-300 px-2.5 py-1 rounded-lg text-xs font-bold">
                            Cancelada por Usuario
                          </span>
                        ) : apt.status === 'RESCHEDULED' ? (
                          <span className="inline-flex items-center text-blue-700 bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-lg text-xs font-bold">
                            Reagendada
                          </span>
                        ) : apt.status === 'PENDING_PAYMENT' || apt.status === 'PENDING' ? (
                          <span className="inline-flex items-center text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg text-xs font-bold">
                            Pendiente de Pago
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg text-xs font-extrabold">
                            🟢 Confirmada
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenAppointmentDoctorDetail(apt)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                          title="Consultar Ficha del Médico y Turno"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Mostrando {filteredAppointments.length} cita(s) con estado específico
            </span>
          </div>
        </div>
      )}

      {/* VISTA 2: TABLA DE TURNOS ORDINARIOS (CUANDO NO SE FILTRA POR ESTADO DE CITA) */}
      {viewMode === 'table' && selectedAppointmentStatus === 'ALL' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#051650] text-white uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Especialidad</th>
                  <th className="py-3 px-4">Médico Especialista</th>
                  <th className="py-3 px-4">Consultorio</th>
                  <th className="py-3 px-4">Día</th>
                  <th className="py-3 px-4">Horario</th>
                  <th className="py-3 px-4">Frecuencia</th>
                  <th className="py-3 px-4">Modalidad</th>
                  <th className="py-3 px-4">Estado de Espacios</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {agendaItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-slate-400 italic">
                      No se encontraron turnos con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  agendaItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/40 transition group"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">{item.specialtyName}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                            {item.doctorName.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 block">{item.doctorName}</span>
                            {item.doctorCode && <span className="text-[10px] text-slate-400">Cód: {item.doctorCode}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                          {item.officeCode ? `#${item.officeCode}` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{item.dayOfWeek}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-blue-700 font-bold">
                        {item.startTime} - {item.endTime}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                          {item.frequencyMinutes} min
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate" title={item.modality}>
                        {item.modality || 'Consulta estándar'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            🟢 {item.availableCount ?? (item.rawSlots?.length || 0)} Disponible(s)
                          </span>
                          {(item.occupiedCount ?? 0) > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              🔴 {item.occupiedCount} Ocupado(s)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            item.scheduleType === 'REGULAR'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {translateScheduleType(item.scheduleType)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenDetail(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                          title="Ver detalle del turno"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Mostrando {agendaItems.length} de {totalItems} registros totales
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 transition font-semibold"
              >
                Anterior
              </button>
              <span className="font-semibold text-slate-700">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 transition font-semibold"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 3: NOVEDADES Y AUSENCIAS */}
      {viewMode === 'absences' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#051650] text-white uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Especialista</th>
                  <th className="py-3 px-4">Especialidad</th>
                  <th className="py-3 px-4">Motivo / Novedad</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Fecha Inicio</th>
                  <th className="py-3 px-4">Fecha Fin</th>
                  <th className="py-3 px-4">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {absences.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                      No se registran novedades o ausencias con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  absences.map((ab) => (
                    <tr key={ab.id} className="hover:bg-rose-50/30 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{ab.doctorName}</td>
                      <td className="py-3 px-4 text-slate-600">{ab.specialty || 'General'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          {ab.reason}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {ab.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {new Date(ab.startDate).toLocaleDateString([], { dateStyle: 'medium' })}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {new Date(ab.endDate).toLocaleDateString([], { dateStyle: 'medium' })}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[250px] truncate" title={ab.observations}>
                        {ab.observations || 'Sin observaciones'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer de Detalle del Turno */}
      <AgendaDetailDrawer
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
      />
    </div>
  );
};
