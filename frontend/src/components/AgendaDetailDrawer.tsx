import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  Calendar,
  Clock,
  MapPin,
  Activity,
  FileText,
  CheckCircle,
  CalendarCheck,
  UserCheck,
  Phone,
  CreditCard,
} from 'lucide-react';
import { MedicalAgendaItem, fetchAppointments, Appointment, socket } from '../lib/api';
import { translatePaymentStatus, translateAppointmentStatus } from '../lib/translations';

interface AgendaDetailDrawerProps {
  item: MedicalAgendaItem | null;
  onClose: () => void;
}

const cleanDoctorName = (name: string) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(dr\(a\)\.|dra\.|dr\.)\s*/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export const AgendaDetailDrawer: React.FC<AgendaDetailDrawerProps> = ({ item, onClose }) => {
  const [doctorAppointments, setDoctorAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(false);
  const [selectedSlotDate, setSelectedSlotDate] = useState<string>('ALL');
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSelectedSlotDate('ALL');
  }, [item?.id]);

  // Manejo de navegación por teclado: cerrar con Escape
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  // Autofoco para accesibilidad al abrir el drawer
  useEffect(() => {
    if (item) {
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
    }
  }, [item]);

  useEffect(() => {
    if (!item) return;

    const loadDoctorAppointments = async () => {
      try {
        setLoadingAppointments(true);
        const allAppointments = await fetchAppointments();
        const targetDoctor = cleanDoctorName(item.doctorName);
        const matched = allAppointments.filter((app) => {
          if (!app.doctorName) return false;
          // Excluir citas canceladas
          if (app.status === 'CANCELLED' || app.status === 'CANCELLED_BY_USER') return false;
          const appDoc = cleanDoctorName(app.doctorName);
          return appDoc.includes(targetDoctor) || targetDoctor.includes(appDoc);
        });
        setDoctorAppointments(matched);
      } catch (err) {
        console.error('Error cargando citas del médico en drawer:', err);
      } finally {
        setLoadingAppointments(false);
      }
    };

    loadDoctorAppointments();

    const handleUpdate = () => loadDoctorAppointments();
    socket.on('appointment_created', handleUpdate);
    socket.on('appointment_updated', handleUpdate);
    socket.on('appointments_updated', handleUpdate);

    return () => {
      socket.off('appointment_created', handleUpdate);
      socket.off('appointment_updated', handleUpdate);
      socket.off('appointments_updated', handleUpdate);
    };
  }, [item]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agenda-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="bg-[#051650] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-white/20 flex items-center justify-center text-sky-300">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 id="agenda-drawer-title" className="font-bold text-base leading-tight">
                {item.doctorName}
              </h3>
              <p className="text-xs text-sky-200 font-medium">{item.specialtyName}</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Cerrar ficha del médico"
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Tag de tipo de jornada */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                item.scheduleType === 'REGULAR'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {item.scheduleType === 'REGULAR' ? 'Agenda Regular 2026' : 'Agenda Adicional'}
            </span>
            {item.doctorCode && (
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Cód: {item.doctorCode}
              </span>
            )}
          </div>

          {/* Seccion de Citas Confirmadas Agendadas por Pacientes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-emerald-600" />
                Citas Confirmadas con el Médico
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {doctorAppointments.length} cita(s)
              </span>
            </div>

            {loadingAppointments ? (
              <p className="text-xs text-slate-500 animate-pulse bg-slate-50 p-3 rounded-xl border border-slate-200">
                Cargando citas del médico...
              </p>
            ) : doctorAppointments.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {doctorAppointments.map((apt) => {
                  const aptDate = new Date(apt.dateTime);
                  const formattedDate = isNaN(aptDate.getTime())
                    ? apt.dateTime
                    : aptDate.toLocaleString('es-CO', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      });

                  return (
                    <div
                      key={apt.id}
                      className="p-3.5 bg-gradient-to-r from-emerald-50/90 to-teal-50/40 rounded-xl border border-emerald-200 shadow-2xs space-y-2 hover:border-emerald-300 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{apt.contactName || 'Paciente Particular'}</span>
                          </div>
                          {apt.contactPhone && (
                            <div className="flex items-center gap-1 text-xs text-slate-600 mt-0.5 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>+{apt.contactPhone}</span>
                            </div>
                          )}
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {translateAppointmentStatus(apt.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-emerald-200/60 text-xs">
                        <div>
                          <span className="text-slate-500 block text-xs uppercase font-bold">Fecha y Hora</span>
                          <span className="font-bold text-slate-800">{formattedDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-xs uppercase font-bold">Especialidad / Ruta</span>
                          <span className="font-semibold text-slate-700">
                            {apt.specialty} · {apt.isReferral ? 'Referido F-03' : 'Ambulatorio F-01'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-emerald-200/60 text-xs">
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono font-bold text-emerald-800">
                            ${Number(apt.price || 0).toLocaleString('es-CO')} COP
                          </span>
                          <span className="text-xs text-slate-500 font-medium">({translatePaymentStatus(apt.paymentStatus)})</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {apt.isFirstTime ? 'Primera Vez' : 'Control'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200 italic">
                No hay citas confirmadas agendadas actualmente para este especialista.
              </p>
            )}
          </div>

          {/* Información principal del turno */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3 text-xs">
            <div className="flex items-center gap-3 text-slate-700">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-slate-500 block text-xs uppercase font-bold">Día de la Semana</span>
                <span className="font-semibold text-slate-800">{item.dayOfWeek}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-700">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-slate-500 block text-xs uppercase font-bold">Horario de Atención</span>
                <span className="font-semibold text-slate-800">
                  {item.startTime} a {item.endTime} (Citas cada {item.frequencyMinutes} min)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-700">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="text-slate-500 block text-xs uppercase font-bold">Consultorio Asignado</span>
                <span className="font-semibold text-slate-800">
                  {item.officeCode ? `Consultorio #${item.officeCode}` : 'Por asignar'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-700">
              <Activity className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-slate-500 block text-xs uppercase font-bold">Actividad Clínica</span>
                <span className="font-semibold text-slate-800">{item.activity || 'CONSULTA EXTERNA'}</span>
              </div>
            </div>
          </div>

          {/* Modalidad y Especificaciones */}
          {(item.modality || item.specifications || item.observations) && (
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                Detalles de la Modalidad
              </h4>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-slate-600 space-y-1.5 leading-relaxed">
                {item.modality && (
                  <p>
                    <strong className="text-slate-700">Modalidad:</strong> {item.modality}
                  </p>
                )}
                {item.specifications && (
                  <p>
                    <strong className="text-slate-700">Jornada:</strong> {item.specifications}
                  </p>
                )}
                {item.observations && (
                  <p>
                    <strong className="text-slate-700">Observaciones:</strong> {item.observations}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Fechas asignadas en el año 2026 */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Fechas Activas Programadas 2026
              </span>
              <span className="text-xs font-normal text-slate-500">
                ({item.activeDates?.length || 0} fechas)
              </span>
            </h4>
            {item.activeDates && item.activeDates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedSlotDate('ALL')}
                  className={`px-2.5 py-1 border rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer ${
                    selectedSlotDate === 'ALL'
                      ? 'bg-[#051650] text-white border-[#051650]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  Todas
                </button>
                {item.activeDates.map((dateStr) => (
                  <button
                    type="button"
                    key={dateStr}
                    onClick={() => setSelectedSlotDate(dateStr)}
                    className={`px-2.5 py-1 border rounded-lg text-xs font-mono shadow-2xs transition cursor-pointer ${
                      selectedSlotDate === dateStr
                        ? 'bg-[#051650] text-white border-[#051650]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    {dateStr}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                No hay fechas específicas mapeadas para este turno.
              </p>
            )}
          </div>

          {/* Espacios Individuales de la Agenda (Disponibles vs. Ocupados) */}
          {Array.isArray(item.rawSlots) && item.rawSlots.length > 0 && (() => {
            const enrichedSlots = item.rawSlots.map((slot) => {
              const slotTime = (slot.hora_inicial || '08:00').substring(0, 5);
              const slotEnd = (slot.hora_final || '').substring(0, 5);
              const matchedApt = doctorAppointments.find((apt) => {
                const dt = new Date(apt.dateTime);
                if (isNaN(dt.getTime())) return false;
                const aptDate = dt.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
                const aptTime = dt.toLocaleTimeString('en-GB', {
                  timeZone: 'America/Bogota',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                });
                return aptDate === slot.fecha_atencion && aptTime === slotTime;
              });
              const isOccupied = Boolean(slot.occupied || slot.statusLabel === 'OCUPADO' || matchedApt);
              const patientLabel = matchedApt?.contactName || slot.patientName || (isOccupied ? 'Espacio Ocupado en Hosvital' : undefined);
              return {
                ...slot,
                slotTime,
                slotEnd,
                isOccupied,
                patientLabel,
              };
            });

            const filteredSlots =
              selectedSlotDate === 'ALL'
                ? enrichedSlots
                : enrichedSlots.filter((s) => s.fecha_atencion === selectedSlotDate);

            const totalAvail = filteredSlots.filter((s) => !s.isOccupied).length;
            const totalOcc = filteredSlots.filter((s) => s.isOccupied).length;

            return (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Espacios de Agenda ({selectedSlotDate === 'ALL' ? 'Todas las fechas' : selectedSlotDate})
                  </h4>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      🟢 {totalAvail} Disponible(s)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      🔴 {totalOcc} Ocupado(s)
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  {filteredSlots.map((slot, idx) => (
                    <div
                      key={`${slot.fecha_atencion}-${slot.slotTime}-${idx}`}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition ${
                        slot.isOccupied
                          ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                          : 'bg-white border-slate-200/90 text-slate-800 hover:border-emerald-300'
                      }`}
                    >
                      <div>
                        <div className="font-mono font-bold text-xs flex items-center gap-2">
                          <span>{slot.fecha_atencion}</span>
                          <span className="text-blue-700">
                            {slot.slotTime} {slot.slotEnd ? `- ${slot.slotEnd}` : ''}
                          </span>
                        </div>
                        {slot.isOccupied && slot.patientLabel && (
                          <div className="text-[11px] font-semibold text-rose-700 mt-0.5">
                            👤 {slot.patientLabel}
                          </div>
                        )}
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide shrink-0 ${
                          slot.isOccupied
                            ? 'bg-rose-200/90 text-rose-900 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {slot.isOccupied ? '🔴 Ocupado' : '🟢 Disponible'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-[#002B49] hover:bg-[#051650] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
